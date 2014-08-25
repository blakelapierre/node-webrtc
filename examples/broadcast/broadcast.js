var http = require('http');
var path = require('path');

var webrtc = require('../..');
var express = require('express');
var socketio = require('socket.io');

var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use('/dist', express.static(__dirname + '/../../dist/'));
router.use('/', express.static(__dirname + '/.'));

var config1 = { iceServers: [{url:'stun:stun.l.google.com:19302'}] };
var config2 = { 'optional': [{DtlsSrtpKeyAgreement: false}] };

var source = null,
    listeners = [];

io.on('connection', function (socket) {
    socket.emit('connected');

    var pc = null;

    function logMessage(message) {
        console.log(message);
        message = 'server: ' + message;
        socket.emit('logmessage',message);
    }

    logMessage('client connected');

    function logError(error) {
        logMessage("Error: " + error);
        throw error;
    }

    function start() {
        logMessage('rtc peer connection object initializing');
        pc = new webrtc.RTCPeerConnection(config1,config2);

        if (source == null) {
            source = pc;

            source.onaddstream = function (evt) {
                var stream = evt.stream;
                var audioTracks = stream.getAudioTracks();

                // libwebrtc currently can't forward remote audio streams
                // if you leave the track enabled, the server will segfault
                // at LocalAudioTrackHandler::OnEnabledChanged(),
                // talk/app/webrtc/mediastreamhandler.cc, line 115 svn R5982
                // the code assumes it is being passed a *LocalAudioTrack*
                // https://code.google.com/p/webrtc/issues/detail?id=2192
                audioTracks.forEach(function(track) {
                    track.enabled = false;
                });

                listeners.forEach(function(listener) {
                    listener.addStream(stream);
                });
                logMessage('broadcast stream added successfully');
            };
        }
        else {
            listeners.push(pc);

            var streams = source.getRemoteStreams();
            streams.forEach(function(stream) {
                pc.addStream(stream);
            });
            console.log('streams', streams);
        }

        pc.onicecandidate = function (evt) {
            if (evt.candidate) {
                logMessage('ice candidate found');
                socket.emit('message', JSON.stringify({ "candidate": evt.candidate }));
            }
        };

        pc.onnegotiationneeded = function () {
            logMessage('creating offer');
            pc.createOffer(localDescCreated, logError);
        };

        logMessage('rtc peer connection created');
    }

    function localDescCreated(desc) {
        logMessage('setting local description');
        pc.setLocalDescription(desc, function () {
            socket.emit('message', JSON.stringify({ "sdp": pc.localDescription }));
        }, logError);
    }

    socket.on('message',function(data) {
        logMessage('message received');
        if (!pc) {
            start();
        }

        var message = JSON.parse(data);
        if (message.sdp) {
            logMessage('sdp message: setting remote description');
            pc.setRemoteDescription(new webrtc.RTCSessionDescription(message.sdp), function () {
                // if we received an offer, we need to answer
                logMessage('remote description set');
                if (pc.remoteDescription.type == "offer") {
                    logMessage('creating answer');
                    pc.createAnswer(localDescCreated, logError);
                }
            }, logError);
        } else if (message.candidate) {
            logMessage('candidate message: adding ice candidate');
            pc.addIceCandidate(new webrtc.RTCIceCandidate(message.candidate));
        }
    });
});

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Stream management server listening at", addr.address + ":" + addr.port);
});
