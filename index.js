const WebSocket = require('ws');
const dgram = require('dgram');
const net = require('net');


//select correct params based on environment
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

function parseHostString(s) {
    if (s[0] === '[') {
        return {
            host: s.split(']:')[0].slice(1),
            port: Number.parseInt(s.split(']:')[1])
        }
    } else return {
        host: s.split(':')[0],
        port: Number.parseInt(s.split(':')[1])
    }
}

const timeoutEase = 100;

// sets a timeout to call f in timeout milliseconds
// returns a function 'reset'
// if this function is called, the timer resets and counts down again
function makeTimeout(f, timeout) {
    let deathTime = Date.now() + timeout
    const wrapped = () => {
        const now = Date.now();
        const timeLeft = deathTime - now;
        if (timeLeft > timeoutEase) {
            dbg('timeout in ', timeLeft)
            setTimeout(wrapped, timeLeft);
        } else {
            f();
        }
    }
    setTimeout(wrapped, timeout);
    return () => {
        deathTime = Date.now() + timeout
    }
}

//possible states for the connection
const INIT = 1, TCP = 2, UDP_A = 3, UDP_B = 4;

let nextConnID = 1;
const TIMEOUT = 30 * 1000;
wss.on('connection', function connection(ws) {

    const connID = nextConnID++;

    console.log('connection', connID);

    let mode = INIT;
    let udpclient, tcpclient;
    let udpPort, udpDest;

    function dropConnection() {
        try {
            ws.close()
        } catch (e) {
        }
        try {
            if (udpclient && udpclient.runn) udpclient.close();
        } catch (e) {
        }

        try {
            if (tcpclient) tcpclient.abort();
        } catch (e) {
        }
    }

    const resetTimeout = makeTimeout(() => {
        console.log(connID, ' timed out')
        dropConnection()
    }, TIMEOUT);

    ws.on('message', function incoming(message) {
        dbg(connID, message);
        resetTimeout();

        if (mode === INIT) {
            message = JSON.parse(message);
            if (message.ConType === 'udp') {
                mode = UDP_A;
                udpclient = dgram.createSocket('udp4');

                udpclient.on('message', (msg, info) => {
                    dbg('udp %d: Received %d bytes from %s:%d\n', connID, msg.length, info.address, info.port);
                    ws.send(msg);
                });
            } else if (message.ConType === 'tcp') {
                tcpclient = new net.Socket();
                const {host, port} = parseHostString(message.Dst)
                tcpclient.connect(port, host, () => {
                    dbg(connID, "tcp connected", port, host);
                });

                tcpclient.on('data', (data) => {
                    dbg(connID, 'tcp data recv', data.length);
                    ws.send(data);
                });
                tcpclient.on('close', () => {
                    dbg(connID, 'tcp close');
                    ws.close();
                });
                tcpclient.on('error', err => {
                    console.error(err);
                    if (!tcpclient.destroyed)
                        tcpclient.end()
                });
                mode = TCP;
            }
        } else if (mode === UDP_A) {
            message = JSON.parse(message);
            const {host, port} = parseHostString(message.Dst)
            udpPort = port;
            udpDest = host;
            mode = UDP_B;
        } else if (mode === UDP_B) {
            udpclient.send(message, udpPort, udpDest, (err) => {
                if (err)
                    console.error(connID, 'udp error', err)
            });
            mode = UDP_A;
        } else if (mode === TCP) {
            tcpclient.write(message);
        }
    });


    ws.on('close', () => {
        console.log('disconnect', connID)
        dropConnection()
    });
    ws.on('error', err => {
        console.error(err);
        ws.close()
    })
});
