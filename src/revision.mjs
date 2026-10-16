// The diff compares actual model output, not intermediate reasoning.
export function revisionParts(before,after){
 const a=Array.from(before),b=Array.from(after);
 if(a.length*b.length>1000000)return [{kind:'delete',text:before},{kind:'insert',text:after}];
 const rows=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)rows[i][j]=a[i]===b[j]?1+rows[i+1][j+1]:Math.max(rows[i+1][j],rows[i][j+1]);
 const parts=[];let i=0,j=0;
 const push=(kind,text)=>{if(parts.at(-1)?.kind===kind)parts.at(-1).text+=text;else parts.push({kind,text});};
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){push('same',a[i++]);j++;}
  else if(i<a.length&&(j===b.length||rows[i+1][j]>=rows[i][j+1]))push('delete',a[i++]);
  else push('insert',b[j++]);
 }
 return parts;
}
export function shouldFinish(heardMs,lastVoice,now){return heardMs>=240&&now-lastVoice>=2500;}
