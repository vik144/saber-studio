const vertexSource = `#version 300 es
out vec2 uv;
void main(){
  vec2 q = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv=q; gl_Position=vec4(q*2.0-1.0,0,1);
}`;
const fragmentSource = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D noiseMap, maskMap;
uniform vec2 world, center;
uniform vec4 ends;
uniform vec3 tint;
uniform vec4 tune; // user width, bloom strength, bloom radius, distortion
uniform float k[11], phase, seed, radius, pixel, alphaMode;
uniform int shape, waveMode, family;
float noise2(vec2 x){
  vec2 i=floor(x), f=fract(x);
  f=f*f*(3.0-2.0*f);
  return texture(noiseMap,(i+f+.5)/256.0).r*2.0-1.0;
}
float fractal(vec2 p){
  mat2 m=mat2(1.63,1.19,-1.19,1.63);
  return .54*noise2(p)+.27*noise2(m*p+17.4)+.135*noise2(m*m*p-3.5)+.055*noise2(m*m*m*p+51.0);
}
float filament(float d,float w){
  return exp(-abs(d)/max(w,.18));
}
void main(){
  vec2 pos=(uv-.5)*world;
  vec2 q=pos-center;
  float d, cap=0.0;
  vec2 axis=pos;
  if(shape==0){
    vec2 a=ends.xy,b=ends.zw;
    vec2 dir=(b-a)/max(length(b-a),.01);
    vec2 h=pos-a;
    d=dot(h,vec2(-dir.y,dir.x));
    float along=dot(h,dir);
    cap=max(max(-along,along-length(b-a)),0.0);
    axis=a+dir*along;
  } else if(shape==1){
    d=length(q)-radius;
    axis=center+q*(radius/max(length(q),.001));
  } else {
    vec3 m=texture(maskMap,vec2(uv.x,1.-uv.y)).rgb;
    d=dot(m.rg,vec2(65280.,255.))/16.*(m.b>.5?-1.:1.);
  }
  // Periodic advection keeps playhead scrubbing and exported loops deterministic.
  float a=phase*6.2831853;
  vec2 drift=vec2(cos(a),sin(a))*(.27+k[9]*1.37);
  vec2 p=pos+vec2(17.3,61.7)*seed;
  float sw=tune.w;
  float broad=fractal(p*.008+drift);
  float mid=fractal(p*.031+drift*1.47+vec2(6.,-15.));
  float fine=fractal(p*.109-drift*2.2);
  float warp=(broad*.6+mid*1.2+fine*.49)*k[1]*sw;
  vec2 anchor=axis+vec2(17.3,61.7)*seed;
  if(waveMode==1) warp=(fractal(anchor*.009+drift)+.09*noise2(anchor*.051-drift))*k[1]*2.8*sw;
  if(waveMode==2) warp=(noise2(anchor*.19+drift)+.45*noise2(anchor*.04+drift))*k[1]*.95*sw;
  float coreD=d-warp;
  float coreCap=exp(-cap*cap/max(1.0,k[0]*tune.x*3.));
  float breakup=mix(1.,.68+.61*mid+.37*fine,k[8]);
  float w=max(.18,k[0]*tune.x*clamp(breakup,.29,1.65));
  float aa=max(.35,pixel*.46);
  float spine=filament(coreD,w*.84+aa*.7)*w/(w+aa*.15)*coreCap;
  float energy=spine*k[6]*3.1;
  float light=0., hot=0., vapor=0.;
  float reach=k[2]*sw;
  float sc=tune.z;
  float nearGlow=filament(length(vec2(coreD,cap)),(3.6+w*1.5)*sc);
  float farGlow=filament(length(vec2(d,cap)),(k[5]*1.25+w)*sc);
  if(k[2]>0.0 && abs(d)<270.+k[2]*sw && cap<180.){
    // Distorting the sampling domain folds a ribbon back on itself, forming
    // branching arcs, isolated knots and curled wisps around the spine.
    vec2 twisted=p*.017+drift;
    twisted+=vec2(broad,mid)*1.65;
    float curl=fractal(twisted+vec2(mid,broad)*1.18);
    float cloudWarp=fractal(p*.011-drift+vec2(curl,mid)*1.8);
    float bounds=exp(-length(vec2(d-warp*.45-cloudWarp*reach*.72,cap))/(5.+reach*.38+k[4]*7.5));
    float billows=.5+.5*fractal(p*.048+vec2(cloudWarp,curl)*2.5-drift);
    vapor=bounds*k[4]*(.095+1.9*pow(billows,3.3))*(.63+.41*broad);
    for(int i=0;i<3;i++){
      float id=float(i);
      vec2 o=vec2(id*31.71,id*15.26);
      vec2 f=p*(.013+id*.0018)+o+drift*(.72+.12*id);
      float fold=fractal(f+vec2(curl,cloudWarp)*(.9+id*.16));
      float thin=fractal(f*3.4+o+vec2(fold,curl)*.9);
      float branch=(fold*.92+thin*.23+mid*.4)*reach;
      float strength=smoothstep(-.46,.55,noise2(f*.78+o)+mid*.41);
      float lineD=length(vec2(d-warp*.7-branch,cap));
      float edge=filament(lineD,(.53+id*.16)*sqrt(tune.x)+aa*.54);
      light+=strength*k[3]*(edge*.96+filament(lineD,3.1*sc)*.23*tune.y);
      hot+=edge*strength*k[3]*.42;
    }
    // Coherent secondary discharges leave the core and reconnect in localized bursts.
    if(k[3]>.34 && (family==1 || family==4 || family==7)){
      for(int i=0;i<2;i++){
        vec2 f=anchor*.018+vec2(81.,37.)*float(i)+drift*.76;
        float pocket=smoothstep(-.19,.71,noise2(f*.73)+.31*noise2(f*1.46));
        float jag=fractal(f*2.3+vec2(5.,13.)+drift*.6);
        float fork=(float(i)*2.-1.)*reach*pocket*(.72+.82*jag+.16*noise2(f*8.1));
        float branchD=length(vec2(coreD-fork,cap));
        float wire=filament(branchD,(.72+.35*pocket)*sqrt(tune.x)+aa*.58);
        float gain=k[3]*smoothstep(.12,.7,pocket);
        light+=gain*(wire*1.28+tune.y*(.49*filament(branchD,4.7*sc)+.18*filament(branchD,14.*sc)));
        hot+=gain*wire*.98;
      }
    }
    // Dense plasma carries light through the volume between the filaments.
    if(family==4 || (family==3 && k[1]>8.)){
      float body=exp(-length(vec2(d-warp-curl*reach*.73,cap))/(2.+reach*.10));
      float ribs=.5+.5*fractal(twisted*2.8+vec2(cloudWarp,curl)*2.4);
      light+=body*pow(ribs,1.8)*k[3]*2.6;
      vapor+=body*ribs*.42*k[4];
    }
    if(k[7]>0.){
      vec2 f=p*vec2(.055,.014)+drift;
      float flame=pow(max(0.,.52+.56*fractal(f+vec2(curl*1.8,broad))),2.)*k[7]*2.;
      float lift=d-warp;
      light+=exp(-length(vec2(lift,cap))/max(1.,flame))*k[7]*.031*(.5+.5*mid)*smoothstep(-2.,4.,lift);
      float wick=noise2(anchor*.115+drift+vec2(mid*.8,curl*.35));
      float tongues=pow(max(0.,wick),1.95)*k[7]*.74*sw;
      float tongue=exp(-abs(lift)/(w+max(.1,tongues*mix(.48,1.,step(0.,lift)))));
      light+=tongue*k[7]*.085*exp(-cap*.24)*(.65+.45*mid);
      hot+=tongue*k[7]*.036*exp(-cap*.41);
    }
    if(k[10]>0.) {
      vec2 cells=p/13.+drift*.27;
      vec2 cell=floor(cells);
      vec2 offset=vec2(noise2(cell+7.),noise2(cell-31.))*.36;
      float spark=length((fract(cells)-.5-offset)*13.);
      hot+=filament(spark,.55+aa*.25)*step(.77,noise2(cell+21.))*bounds*k[10]*3.6;
    }
  }
  float bloom=(nearGlow*(.51+.22*k[6])+farGlow*(.16+.09*k[6]))*min(1.25,k[6]);
  float exposure=energy+light+vapor*1.5+bloom*tune.y;
  // Separate spectral emission and white-hot highlights keep the outer halo saturated.
  vec3 spectral=pow(tint,vec3(2.65));
  vec3 radiance=spectral*exposure;
  radiance+=pow(tint,vec3(.55))*(energy*.39+hot*.82);
  radiance+=vec3(1.,.98,.94)*(pow(spine,1.8)*pow(k[6],1.4)*2.3+pow(min(hot,2.),1.72)*.83);
  vec3 rgb=1.-exp(-radiance);
  vec3 encoded=pow(max(rgb,0.),vec3(.73));
  outColor=vec4(encoded,1.);
}`;

// The mip chain integrates the rendered filaments at multiple spatial scales.
// Filtering each level before compositing lets individual hot spots illuminate the haze.
const bloomSource = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D scene;
uniform vec3 tint;
uniform float glow, spread, pixel, alphaMode;
vec3 halo(float radius){
  float lod=max(0.,log2(max(1.,radius/pixel))-.75);
  vec2 stepUV=exp2(lod)/vec2(textureSize(scene,0));
  vec3 sum=.28*textureLod(scene,uv,lod).rgb;
  sum+=.18*textureLod(scene,uv+stepUV*vec2(.79,.63),lod).rgb;
  sum+=.18*textureLod(scene,uv-stepUV*vec2(.79,.63),lod).rgb;
  sum+=.18*textureLod(scene,uv+stepUV*vec2(-.63,.79),lod).rgb;
  sum+=.18*textureLod(scene,uv-stepUV*vec2(-.63,.79),lod).rgb;
  return sum;
}
void main(){
  vec3 base=textureLod(scene,uv,0.).rgb;
  vec3 bloom=halo(7.*spread)*.39+halo(22.*spread)*.78+halo(68.*spread)*.79;
  vec3 filtered=bloom*mix(vec3(.055),pow(tint,vec3(1.48)),.96)*glow;
  vec3 rgb=base+(1.-base)*(1.-exp(-filtered));
  float opacity=max(rgb.r,max(rgb.g,rgb.b));
  if(alphaMode>.5) outColor=vec4(rgb/max(opacity,.00001),opacity);
  else outColor=vec4(rgb+vec3(.003,.006,.014)*(1.-opacity),1.);
}`;

function compileProgram(gl,fragment){
    const program=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragment]]){
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader); gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
}
class SaberRenderer {
  constructor(canvas) {
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    if(!gl) throw new Error('WebGL 2 is unavailable. Enable graphics acceleration in your browser to render the effect.');
    this.gl=gl;
    const program=compileProgram(gl,fragmentSource);
    this.bloomProgram=compileProgram(gl,bloomSource);
    gl.useProgram(this.bloomProgram);
    this.b=Object.fromEntries('scene tint glow spread pixel alphaMode'.split(' ').map(key=>[key,gl.getUniformLocation(this.bloomProgram,key)]));
    gl.uniform1i(this.b.scene,2);
    this.framebuffer=gl.createFramebuffer();
    this.scene=gl.createTexture();
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,this.scene);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.useProgram(program); this.program=program;
    this.u=Object.fromEntries('world center ends tint tune k[0] phase seed radius pixel shape waveMode family'.split(' ').map(key=>[key,gl.getUniformLocation(program,key)]));
    let r=127091;
    const noise=Uint8Array.from({length:256*256},()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r>>>24});
    this.texture(0,'noiseMap',gl.R8,256,256,gl.RED,noise,gl.REPEAT);
    this.mask=this.texture(1,'maskMap',gl.RGBA8,1,1,gl.RGBA,new Uint8Array([255,255,0,255]),gl.CLAMP_TO_EDGE);
  }
  texture(unit,name,internal,w,h,format,data,wrap){
    const gl=this.gl, tex=gl.createTexture();
    gl.activeTexture(gl.TEXTURE0+unit); gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,internal,w,h,0,format,gl.UNSIGNED_BYTE,data);
    for(const key of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D,key,wrap);
    for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D,key,gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(this.program,name),unit); return tex;
  }
  setMask(mask) {
    const gl=this.gl; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,this.mask);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,mask.width,mask.height,0,gl.RGBA,gl.UNSIGNED_BYTE,mask.data);
  }
  render(s,width,height,thumbnail=false,transparent=false){
    const gl=this.gl, u=this.u, c=this.canvas;
    if(c.width!==width || c.height!==height){c.width=width;c.height=height}
    gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
    if(this.targetWidth!==width || this.targetHeight!==height){
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.scene);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.scene,0);
      this.targetWidth=width;this.targetHeight=height;
    }
    gl.useProgram(this.program);gl.viewport(0,0,width,height);
    const ww=thumbnail?1040:1920, wh=thumbnail?height/width*ww:1080;
    const [cr,cg,cb]=s.color.match(/\w\w/g).map(x=>parseInt(x,16)/255);
    const p=s.preset;
    gl.uniform2f(u.world,ww,wh);
    gl.uniform2fv(u.center,s.center);
    gl.uniform4fv(u.ends,thumbnail?[-ww*.415,0,ww*.415,0]:s.ends);
    gl.uniform1f(u.radius,s.radius);
    gl.uniform3f(u.tint,cr,cg,cb);
    gl.uniform4f(u.tune,s.width,s.intensity,s.spread,s.distortion);
    gl.uniform1fv(u['k[0]'],p.p); gl.uniform1f(u.phase,s.time/8);
    gl.uniform1f(u.seed,p.id*.731); gl.uniform1f(u.pixel,ww/width);
    gl.uniform1i(u.shape,thumbnail?0:['Line','Ring','Text','Path'].indexOf(s.shape));
    gl.uniform1i(u.family,Object.keys(families).indexOf(p.family));
    gl.uniform1i(u.waveMode,p.name==='Tractor Beam'?2:p.family==='wave'?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.scene);gl.generateMipmap(gl.TEXTURE_2D);
    gl.useProgram(this.bloomProgram);
    const b=this.b;
    gl.uniform3f(b.tint,cr,cg,cb);const glowScale=p.family==='arc'?.86:p.family==='clean'?.65:.57;
    gl.uniform1f(b.glow,s.intensity*glowScale*Math.min(1.15,p.p[6]));
    gl.uniform1f(b.spread,s.spread*Math.max(.16,p.p[5]/23));
    gl.uniform1f(b.pixel,ww/width);gl.uniform1f(b.alphaMode,transparent?1:0);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
}
