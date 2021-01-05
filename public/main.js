//// Elements
const $rtcMsg = document.getElementById('rtc-msg');
const $sendRTCMsg = document.getElementById('send-rtc-msg');
const $receivedMsgs = document.getElementById('received-messages');
const $webrtcConect = document.getElementById('webrtc-connect');
const $webrtcInteract = document.getElementById('webrtc-interact');


//// Event Listeners
$sendRTCMsg.addEventListener('click', sendRTCMsg);


//// WebRTC Setup
//
// No STUN / TURN servers needed when all peers are on the same LAN
const peerConnectionConfig = { iceServers: [] };

//// A configuration with STUN servers could look like this:
// const peerConnectionConfig = {
//   'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}],
//   iceTransportPolicy: 'all'
// }

//// Setting up RTCDataChannel options
//
// By default (negoiated: false), data channels are negotiated in-band,
// where one side calls createDataChannel, and the other side 
// listens to the RTCDataChannelEvent event using the ondatachannel
// EventHandler. Alternatively (negotiated: true), they can be negotiated
// out of-band, where both sides call createDataChannel with an agreed-upon id. 
//
// var dataChannelSettings = {
//   ordered: false, // sets reliable vs. unreliable mode
//   maxRetransmits: 0
// };


//// Main Program
//
let peerConnection = null;
let wsConn = null;
let dc = null;

wsConn = new WebSocket('wss://' + window.location.hostname + ':3000');
wsConn.onmessage = processServerMsg;

$receivedMsgs.value = '';


//// Functions
//
async function getMedia() {
  // Safari and Firefox require media in order to establish a webRTC connection
  // Chrome allows this step to be bypassed if a datachannel is established instead
  var constraints = {
    video: false,
    audio: true,
  };
  
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      // this is where media stream would be used
      show($webrtcConect);   
    } catch(err) {
      errorHandler(err)
    }
  } else {
    alert('getUserMedia API is not supported by this browser');
  }
}

async function createPeerConnection(isCaller) {
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = sendIceCandidate;
  
  if(isCaller) {
    dc = peerConnection.createDataChannel('main');
    setupDC(dc);

    const offer = await peerConnection.createOffer();
    createdDescription(offer)
  } else {
    // callee doesn't need to create datachannel because caller already has
    // callee just needs to save a reference to the datachannel that
    // gets sent when the webRTC connection is established 
    peerConnection.ondatachannel = connectDC
  }
}

async function processServerMsg(message) {
  if(!peerConnection) createPeerConnection(false);

  const msg = JSON.parse(message.data);

  // For any description received, it must be the remote description
  if(msg.sdp) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
    } catch(err) {
      errorHandler(err);
    }
    
    // Only create an answer only for the first description (the offer)
    if (msg.sdp.type === 'offer') {
      try {
        const answer = await peerConnection.createAnswer();
        createdDescription(answer)
      } catch(err) {
        errorHandler(err);
      }
    }
  } else if (msg.ice) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(msg.ice))
    } catch (err) {
      errorHandler(err)
    }
  }
}

function sendIceCandidate(evt) {
  // needs to filter candidates where the candidate string is ""
  // in order to work in certain browsers, ie Safari
  if(evt.candidate != null && evt.candidate.candidate) {
    wsConn.send(JSON.stringify({'ice': evt.candidate}));
  }
}


// Create local session description
// (information the other peer needs to connect to this one)
// Send that information to the server, to be sent to the remote peer
// This function sets the local description for both peers
async function createdDescription(description) {
  try {
    await peerConnection.setLocalDescription(description)
    wsConn.send(JSON.stringify({sdp: peerConnection.localDescription}))
  } catch(err) {
    errorHandler(err);
  }
}

function connectDC(channelObj) {
  console.log('setting up data channel', channelObj)
  dc = channelObj.channel
  setupDC(dc);
}

function setupDC(channel) {
  channel.onopen = () => { show($webrtcInteract); }
  channel.onmessage = handleDCMessage;
  channel.onerror = errorHandler;
}

function handleDCMessage(msg) {
  console.log('got datachannel message', msg);
  updateReceivedMsgsView(msg.data)
}

function updateReceivedMsgsView(msg) {
  const separator = $receivedMsgs.value ? '\n' : '';
  $receivedMsgs.value += separator + msg
}

function errorHandler(err) {
  console.error(err);
}

function sendRTCMsg(evt) {
  dc.send($rtcMsg.value)
  $rtcMsg.value = '';
}

function show($el) {
  $el.style.display = 'block'
}