const WebSocket = require('ws');
const dgram = require('dgram');
const net = require('net');


const init = 1, tcp = 2, udpA = 3, udpB = 4;
let port = 80, host = '0.0.0.0';
let dbg = function (...arg) {
    console.log(...arg)
};
if (process.env.PORT) {
    port = Number.parseInt(process.env.PORT);
    host = undefined;
    dbg = () => {
    };
}

const wss = new WebSocket.Server({port, host});

function phost(s){
    if(s[0]==='['){
        return {
            host:s.split(']:')[0].slice(1),
            port:Number.parseInt(s.split(']:')[1])
        }
    }else return {
        host:s.split(':')[0],
        port:Number.parseInt(s.split(':')[1])
    }
}

const err=100;
function makeTimeout(f, timeout){
    let death=Date.now()+timeout
    const wrapped=()=>{
        const now=Date.now();
        const timeleft=death-now;
        if(timeleft>err){
            dbg('timeout in ', timeleft)
            setTimeout(wrapped,timeleft);
        }else{
            f();
        }
    }
    setTimeout(wrapped, timeout);
    return ()=>{
        death=Date.now()+timeout
    }
}

let id = 1;
const tt=30*1000;
wss.on('connection', function connection(ws) {

    const idd = id++;

    console.log('connection', idd);

    let mode = init;
    let udpclient, tcpclient;
    let udpPort, udpDest;

    const resetTimeout=makeTimeout(()=>{
        console.log(idd,' timed out')
        ws.close()
        try {
            if (udpclient && udpclient.runn) udpclient.close();
        }catch(e){

        }
        try{
            if(tcpclient)tcpclient.abort();

        }catch (e){}
    }, tt);

    ws.on('message', function incoming(message) {
        dbg(idd, message);
        resetTimeout();

        if (mode === init) {
            message = JSON.parse(message);
            if (message.ConType === 'udp') {
                mode = udpA;
                udpclient = dgram.createSocket('udp4');

                udpclient.on('message', (msg, info) => {
                    dbg('udp %d: Received %d bytes from %s:%d\n', idd, msg.length, info.address, info.port);
                    ws.send(msg);
                });
            } else if (message.ConType === 'tcp') {
                tcpclient = new net.Socket();
                const {host,port}=phost(message.Dst)
                tcpclient.connect(port, host, () => {
                    dbg(idd, "tcp connected", port, host);
                });

                tcpclient.on('data', (data) => {
                    dbg(idd, 'tcp data recv', data.length);
                    ws.send(data);
                });
                tcpclient.on('close', () => {
                    dbg(idd, 'tcp close');
                    ws.close();
                });
                tcpclient.on('error', err => {
                    console.error(err);
                    if (!tcpclient.destroyed)
                        tcpclient.end()
                });
                mode = tcp;
            }
        } else if (mode === udpA) {
            message = JSON.parse(message);
            const {host,port}=phost(message.Dst)
            udpPort = port;
            udpDest = host;
            mode = udpB;
        } else if (mode === udpB) {
            udpclient.send(message, udpPort, udpDest, (err) => {
                if (err)
                    console.error(idd, 'udp error', err)
            });
            mode = udpA;
        } else if (mode === tcp) {
            tcpclient.write(message);
        }
    });


    ws.on('close', () => console.log('disconnect', idd));
    ws.on('error', err => {
        console.error(err);
        ws.close()
    })


});
