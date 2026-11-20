// Exact Euclidean distance transform of a rasterized outline, in two 1D passes.
function distanceTransform(values, width, height) {
  const n=Math.max(width,height), v=new Int32Array(n), z=new Float64Array(n+1);
  const line=new Float64Array(n), out=new Float64Array(n);
  function transform(length) {
    let k=0; v[0]=0; z[0]=-Infinity; z[1]=Infinity;
    for(let q=1;q<length;q++) {
      let s;
      do {
        const i=v[k]; s=((line[q]+q*q)-(line[i]+i*i))/(2*(q-i));
        if(s>z[k]) break;
        k--;
      } while(k>=0);
      v[++k]=q; z[k]=s; z[k+1]=Infinity;
    }
    k=0;
    for(let q=0;q<length;q++){
      while(z[k+1]<q) k++;
      out[q]=(q-v[k])**2+line[v[k]];
    }
  }
  for(let y=0;y<height;y++){
    line.set(values.subarray(y*width,(y+1)*width)); transform(width);
    values.set(out.subarray(0,width),y*width);
  }
  for(let x=0;x<width;x++){
    for(let y=0;y<height;y++) line[y]=values[y*width+x];
    transform(height);
    for(let y=0;y<height;y++) values[y*width+x]=out[y];
  }
}
function encodeDistance(dist,width,height){
  const data=new Uint8Array(width*height*4);
  for(let i=0;i<dist.length;i++){
    const v=Math.max(0,Math.min(65535,Math.round(Math.abs(dist[i])*16)));
    data[i*4]=v>>8;data[i*4+1]=v&255;
    data[i*4+2]=dist[i]<0?255:0;data[i*4+3]=255;
  }
  return {width,height,data};
}
function textDistance(text) {
  const width=1536,height=864,canvas=document.createElement('canvas'); canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.font='700 300px "DM Sans", sans-serif';
  const size=Math.min(300,300*(width*.78)/Math.max(1,ctx.measureText(text).width));
  ctx.font='700 '+size+'px "DM Sans", sans-serif';
  const metric=ctx.measureText(text);ctx.textAlign='center'; ctx.fillStyle='white';
  ctx.fillText(text,width*.5,height*.5+(metric.actualBoundingBoxAscent-metric.actualBoundingBoxDescent)*.5);
  const pixels=ctx.getImageData(0,0,width,height).data,inside=new Uint8Array(width*height);
  const d=new Float32Array(width*height);d.fill(1e9);
  for(let i=0;i<d.length;i++) inside[i]=pixels[i*4+3]>127?1:0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x;
    if(inside[i]&&(inside[i-1]===0||inside[i+1]===0||inside[i-width]===0||inside[i+width]===0)) d[i]=0;
  }
  distanceTransform(d,width,height);
  for(let i=0;i<d.length;i++) d[i]=(inside[i]?-1:1)*Math.sqrt(d[i])*1920/width;
  return encodeDistance(d,width,height);
}
function pathDistance(points){
  const width=960,height=540,d=new Float32Array(width*height);d.fill(800);
  const reach=260;
  for(let j=1;j<points.length;j++){
    const [ax,ay]=points[j-1], [bx,by]=points[j], dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
    if(length<.001)continue;
    const x0=Math.max(0,Math.floor((Math.min(ax,bx)-reach+960)/2)),x1=Math.min(width-1,Math.ceil((Math.max(ax,bx)+reach+960)/2));
    const y0=Math.max(0,Math.floor((540-Math.max(ay,by)-reach)/2)),y1=Math.min(height-1,Math.ceil((540-Math.min(ay,by)+reach)/2));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const px=(x+.5)*2-960-ax,py=540-(y+.5)*2-ay;
      const t=Math.min(1,Math.max(0,(px*dx+py*dy)/length));
      const sq=(px-t*dx)**2+(py-t*dy)**2, i=y*width+x;
      if(sq<d[i]*d[i])d[i]=(dx*py-dy*px<0?-1:1)*Math.sqrt(sq);
    }
  }
  return encodeDistance(d,width,height);
}
