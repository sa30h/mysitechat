console.log('main.js')

var mapPeers={};

var labelUsername=document.querySelector('#label-username')
var usernameInput=document.querySelector('#username')
var btnJoin=document.querySelector('#btn-join')
var candidates={};
var username;
var peer2;
var webSocket;
const senders=[];


function webSocketOnMessage(event){
    var parsedData=JSON.parse(event.data)
    var peerUsername=parsedData['peer'];
    var action=parsedData['action'];

    if(username== peerUsername){
        return;
    }
    var receiver_channel_name=parsedData['message']['receiver_channel_name'];

    if(action=='new-peer'){
        createOfferer(peerUsername,receiver_channel_name);
        return;
    } 

    if(action == 'new-offer'){
        var offer=parsedData['message']['sdp'];
        createAnswerer(offer,peerUsername,receiver_channel_name);
        return;
    }

    if(action == 'new-answer'){
        var answer= parsedData['message']['sdp']

        var peer=mapPeers[peerUsername][0];
        peer.setRemoteDescription(answer);
        return;
    }

}

btnJoin.addEventListener('click',()=>{
    username=usernameInput.value;

    if(username === '' ){
        return;
    }
    usernameInput.value="";
    usernameInput.disabled=true;
    usernameInput.style.visibility='hidden';

    btnJoin.disabled=true;
    btnJoin.style.visibility='hidden';
    labelUsername.innerHTML=username;

    const roomNamestr = JSON.parse(document.getElementById('room-name').textContent);


    var loc=window.location;
    var wsStart='ws://';

    if(loc.protocol == 'htpps:'){
        wsStart='wss://';
    }

    var endpoint=wsStart+loc.host+'/ws/chat/'+roomNamestr+'/';
    // 'ws://'
    // + window.location.host
    // + '/ws/chat/'
    // + roomName
    // + '/'
    console.log('endpoint',endpoint);

    webSocket=new WebSocket(endpoint);

    webSocket.addEventListener('open',(e)=>{
        console.log('connection open');
        sendSignal("new-peer",{});
       
    })

    webSocket.addEventListener('message',webSocketOnMessage);

    webSocket.addEventListener('close',(e)=>{
        console.log('connection close')
    })

    webSocket.addEventListener('error',(e)=>{
        console.log('connection errop')
    })


})

var localStream=new MediaStream();
var constraints={
    'video':true,
    'audio':true
};
const localVideo=document.querySelector('#local-video');
const btnToggleVideo=document.querySelector('#btn-toggle-video');
const btnToggleAudio=document.querySelector('#btn-toggle-audio');


var userMedia =navigator.mediaDevices.getUserMedia(constraints)
.then(stream=>{
    localStream=stream;
    localVideo.srcObject=localStream;
    localVideo.muted=true;
    
    var audioTracks=stream.getAudioTracks();
    var videoTracks=stream.getVideoTracks();

    audioTracks[0].enabled=true;
    videoTracks[0].enabled=true;

    btnToggleAudio.addEventListener('click',()=>{
        audioTracks[0].enabled=!audioTracks[0].enabled;

        if(audioTracks[0].enabled){

            btnToggleAudio.innerHTML='Audio Mute';
            return;
        }
        btnToggleAudio.innerHTML='Audio Unmute'
    })

    btnToggleVideo.addEventListener('click',()=>{
        videoTracks[0].enabled=!videoTracks[0].enabled;

        if(videoTracks[0].enabled){

            btnToggleVideo.innerHTML='Video Off';
            return;
        }
        btnToggleVideo.innerHTML='Video On'
    })
})
.catch(error=>{
    console.log('error accessing media devices')
})

var btnSendMsg=document.querySelector('#btn-send-msg');
btnSendMsg.addEventListener('click',sendMsgonClick);

var messageInput=document.querySelector('#msg')

var messageList=document.querySelector('#message-list');


function sendMsgonClick(){

    var message=messageInput.value;
    // var li=document.createElement('li');
    // li.appendChild(document.createTextNode('Me:'+message));
    // messageList.appendChild(li)
    document.querySelector('#chat-log').value += ('You:'+'\n'+message + '\n');
    var dataChannels=getDataChannels();

    message=username+'\n'+':'+message;

    for(index in dataChannels){
        dataChannels[index].send(message);

    }
    messageInput.value='';
}


function sendSignal(action,message){

    var jsonStr=JSON.stringify({
        "peer":username,
        "action":action,
        "message":message,
    });
    
    webSocket.send(jsonStr)
}

function createOfferer(peerUsername,receiver_channel_name){
    var peer=new RTCPeerConnection(null) ;//null for same wifi connection
    
console.log('in createofferer',peer.getSenders())

    addLocalTracks(peer)

    var dc=peer.createDataChannel('channel');

    dc.addEventListener('open',()=>{
        console.log('dc connecton open')
    })

    dc.addEventListener('message',dcOnMessage)

    var remoteVideo=createVideo(peerUsername);
    setOnTrack(peer,remoteVideo);

    mapPeers[peerUsername]=[peer,dc];

    peer.addEventListener('iceconnectionstatechange',()=>{

        var iceConnectionState=peer.iceConnectionState;

        if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername];
            if(iceConnectionState != 'closed'){
                peer.close()
            }
            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate',(event)=>{
        if(event.candidate){
            console.log('New ice candidate',JSON.stringify(peer.localDescription));
            return;
        }
        sendSignal('new-offer',{
            'sdp':peer.localDescription,
            'receiver_channel_name':receiver_channel_name
        })
    })

    peer.createOffer()
                .then(o=>peer.setLocalDescription(o))
                .then(()=>{
                    console.log('Local description set succesfully')
                })

}

function createAnswerer(offer,peerUsername,receiver_channel_name){

    var peer=new RTCPeerConnection(null) ;//null for same wifi connection
    peer2=peer;

    addLocalTracks(peer)

    console.log('in createanswer',peer.getSenders())
   

    var remoteVideo=createVideo(peerUsername);
    setOnTrack(peer,remoteVideo);

           

    peer.addEventListener('datachannel',e=>{
        peer.dc=e.channel;
        peer.dc.addEventListener('open',()=>{
            console.log('dc connecton open')
            
        })
    
        peer.dc.addEventListener('message',dcOnMessage)
        senders.push(peer)
        mapPeers[peerUsername]=[peer,peer.dc];
     
    })



    peer.addEventListener('iceconnectionstatechange',()=>{

        var iceConnectionState=peer.iceConnectionState;

        if(iceConnectionState === 'failed' || iceConnectionState === 'disconnected' || iceConnectionState === 'closed'){
            delete mapPeers[peerUsername];
            if(iceConnectionState != 'closed'){
                peer.close()
            }
            removeVideo(remoteVideo);
        }
    });

    peer.addEventListener('icecandidate',(event)=>{
        if(event.candidate){
            console.log('New ice candidate',JSON.stringify(peer.localDescription));
            return;
        }
        sendSignal('new-answer',{
            'sdp':peer.localDescription,
            'receiver_channel_name':receiver_channel_name
        })
    })

   peer.setRemoteDescription(offer)
        .then(()=>{
            console.log('Remote description set succesfully for %s.',peerUsername)
            peer.createAnswer();
        })
        .then(a=>{
            console.log('Answer created');
            peer.setLocalDescription(a);
        })

}


function addLocalTracks(peer){
    localStream.getTracks().forEach(track=>{
        // senders.push(peer.addTrack(track, userMediaStream))
        peer.addTrack(track,localStream);
    })
    return;

 
}



document.querySelector('#msg').focus();
        document.querySelector('#msg').onkeyup = function(e) {
            if (e.keyCode === 13) {  // enter, return
                document.querySelector('#btn-send-msg').click();
            }
        };

function dcOnMessage(event){

    // const data = JSON.parse(e.data);
    // document.querySelector('#chat-log').value += (data.message + '\n');
    var message=event.data;

    // var li=document.createElement('li');
    // li.appendChild(document.createTextNode(message));
    // messageList.appendChild(li);

    // const data = JSON.parse(event.data);
    document.querySelector('#chat-log').value += (message + '\n');
}

function createVideo(peerUsername){

    var videoContainer=document.querySelector('#video-container');
    var remoteVideo=document.createElement('video');
    var userlabel=document.createElement('h5');
  
    remoteVideo.id=peerUsername+'-video';
    remoteVideo.autoplay=true;
    remoteVideo.playsInline=true;
    var videoWrapper=document.createElement('div');
    videoWrapper.className='card-body ';
    userlabel.className='card-title'
    userlabel.innerHTML=peerUsername;

    videoContainer.appendChild(videoWrapper);

    videoWrapper.appendChild(remoteVideo);
    videoWrapper.appendChild(userlabel);
    // console.log('dd',senders)
    return remoteVideo;
}

function setOnTrack(peer,remoteVideo){
    var remoteStream=new MediaStream();
   
    remoteVideo.srcObject=remoteStream;
    peer.addEventListener('track',async(event)=>{
        remoteStream.addTrack(event.track,remoteStream);

    })

}



function removeVideo(video){
    var videoWrapper=video.parentNode;
    videoWrapper.parentNode.removeChild(videoWrapper);
}

function getDataChannels(){
    var dataChannels=[];
    for(peerUsername in mapPeers){
        var dataChannel=mapPeers[peerUsername][1];
        dataChannels.push(dataChannel);
    }
    return dataChannels;
}

let screenStream;
let remoteScreenStrea;
let localStreamScreen=document.querySelector('#localScreen')
let remoteStreamScreen=document.querySelector('#remoteScreen')
var btnScreenshare=document.querySelector('#btn-share-screen');


async function handleSuccess(stream,peer) {
    // btnScreenshare.disabled = true;
    
//    await console.log('senderList',mapPeers)

await console.log('sendeee',peer.getSenders())

peer.getSenders().find(sender => sender.track.kind === "video").replaceTrack(stream.getTracks()[0]);

    // peer.forEach(function(pc) {
 
    stream.getVideoTracks()[0].addEventListener('ended', async () => {
        let videoTrack= await navigator.mediaDevices.getUserMedia({audio: false, video: true})
                .then(mediaStream => {return mediaStream})
    //   errorMsg('The user has ended sharing the screen');
    peer.getSenders().find(sender => sender.track.kind === "video").replaceTrack(videoTrack.getTracks()[0]);

      btnScreenshare.disabled = false;
    });
  }

  btnScreenshare.addEventListener('click', () => {

    // var peer=new RTCPeerConnection(null);
    // navigator.mediaDevices.getDisplayMedia({ cursor: true }).then(stream => {
    //     //         const screenTrack = stream.getTracks()[0];
    screenStream=navigator.mediaDevices.getDisplayMedia({video: true})
    .then(stream=>{handleSuccess(stream,peer)});
});


