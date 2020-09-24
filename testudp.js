const udp=require('dgram');
const s1=udp.createSocket('udp4');
const s2=udp.createSocket('udp4');

setTimeout(()=>{
    s1.on('message',()=>console.log('sk1 recv'));
     s2.on('message',()=>console.log('sk2 recv'));

    s1.send(Buffer.from(Buffer.from([12,113,1,0,0,1,0,0,0,0,0,0,14,101,106,103,105,117,98,103,117,114,109,114,120,101,100,0,0,1,0
        ,1])),53,'8.8.8.8');

},200);
