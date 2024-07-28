const { ipcRenderer } = require('electron');
const io = require('socket.io-client');
const { RTCPeerConnection, RTCSessionDescription } = window;
window.$ = window.jQuery = require('jquery');

let pc = null;
let dataChannel = null;
let socket = null;
let power = false;
let phonePeersId;

ipcRenderer.on('info', (event, data) => {
    let ip = data.ip;
    let hostname = data.hostname;
    document.getElementById('ip-address').innerText = ip;
    document.getElementById('hostname').innerText = hostname;
});

function connected(peersId) {
    $(".power-controller").fadeOut(500, function () {
      $(".phone-container").fadeIn(800);
    });

    $("#phone-code").text(peersId);
    $("#phone-ip").text("192.168.1.1");
}
  
function disconnected() {
    $(".phone-container").fadeOut(500, function () {
        $(".power-controller").fadeIn(800);
    });
}

document.getElementById('expelButton').onclick = function() {
    if(socket && phonePeersId) socket.emit('expel-device', phonePeersId);
};

document.querySelectorAll('.power').forEach(function(element) {
    element.addEventListener('click', function() {
        if (power) {
            power = false;
            element.src = "img/apagado.png";
            ipcRenderer.send('stop-servers', 'Detener servidores');
        } else {
            power = true;
            element.src = "img/encendido.png";
            ipcRenderer.send('start-servers', 'Iniciar servidores');
            setupServer();
        }
    });
});

function setupServer(){
    socket = io('http://localhost:3000', {
        transports: ['websocket'],
    });

    socket.on('connect', () => {});

    socket.on('phone-connected', (peersId) => {
        connected(peersId);
        phonePeersId = peersId;
    });

    socket.on('phone-disconnected', () => {
        disconnected();
    });

    socket.on('message', (message) => {
        handleSignalingMessage(message);
    });

    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
        alert('Stream obtenido:', stream);
        alert('Pistas de audio:', stream.getAudioTracks());

        stream.getAudioTracks().forEach(track => {
            pc.addTrack(track, stream);
        });
    })
    .catch(error => {
        console.error('Error al obtener la pista de audio:', error);
    });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('message', { type: 'ice-candidate', candidate: event.candidate });
        }
    };

    pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        dataChannel.onopen = () => {
            alert('Canal de datos abierto');
        };

        dataChannel.onmessage = (event) => {
            alert('Mensaje en data channel recibido: ' + event.data);
        };
    };
}

function handleSignalingMessage(message) {
    const { type, data } = message;

    if (type === 'offer') {
        pc.setRemoteDescription(new RTCSessionDescription(data))
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer))
            .then(() => {
                socket.emit('message', { type: 'answer', data: pc.localDescription });
            })
            .catch((error) => alert('Error handling offer: ' + error));
    } else if (type === 'answer') {
        pc.setRemoteDescription(new RTCSessionDescription(data))
            .catch((error) => alert('Error handling answer: ' + error));
    } else if (type === 'ice-candidate') {
        pc.addIceCandidate(new RTCIceCandidate(data))
            .catch((error) => alert('Error adding ICE candidate: ' + error));
    }
}
