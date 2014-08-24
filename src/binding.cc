#include <node.h>
#include <v8.h>

#include "webrtc/base/ssladapter.h"

#include "peerconnection.h"
#include "datachannel.h"
#include "mediastream.h"
#include "mediastreamtrack.h"

void init(v8::Handle<v8::Object> exports) {
  rtc::InitializeSSL();
  node_webrtc::PeerConnection::Init(exports);
  node_webrtc::DataChannel::Init(exports);
  MediaStream::Init(exports);
  MediaStreamTrack::Init(exports);
}

NODE_MODULE(wrtc, init)