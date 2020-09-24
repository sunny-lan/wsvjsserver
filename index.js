const WebSocket = require('ws');
const dgram = require('dgram');
const net =require('net');


const init=1, tcp=2, udpA=3, udpB=4;
let port=80, host='0.0.0.0';

if(process.env.PORT){
    port=Number.parseInt(process.env.PORT);
    host=undefined;
}

const wss = new WebSocket.Server({port, host});

let id=1;
wss.on('connection', function connection(ws) {

    const idd=id++;

    console.log('connection',idd);

    let mode=init;
    let udpclient,tcpclient;
    let udpPort, udpDest;

    ws.on('message', function incoming(message) {
        console.log(idd,message);

        if(mode===init){
            message=JSON.parse(message);
            if(message.ConType==='udp'){
                mode=udpA;
                udpclient=dgram.createSocket('udp4');
                udpclient.on('message', (msg,info)=>{
                    console.log('udp %d: Received %d bytes from %s:%d\n',idd,msg.length, info.address, info.port);
                    ws.send(msg);
                });
            }else if(message.ConType==='tcp'){
                tcpclient=new net.Socket();
                const host=message.Dst.split(':')[0];
                const port=Number.parseInt(message.Dst.split(':')[1]);
                tcpclient.connect(port,host, ()=>{
                    console.log(idd, "tcp connected", port, host);
                });

                tcpclient.on('data', (data)=>{
                    console.log(idd,'tcp data recv', data.length);
                    ws.send(data);
                });
                tcpclient.on('close',()=>{
                   console.log(idd, 'tcp close');
                   ws.close();
                });
                mode=tcp;
            }
        }else if(mode===udpA){
            message=JSON.parse(message);
            udpPort=message.Port;
            udpDest=message.Dst.split(':')[0];
            mode=udpB;
        }else if(mode===udpB){
            udpclient.send(message, udpPort,udpDest,(err)=>{
                if(err)
                console.error(idd,'udp error',err)
            });
            mode=udpA;
        }else if(mode===tcp){
            tcpclient.write(message);
        }
    });


     ws.on('close', ()=>console.log('exit',idd));


});
