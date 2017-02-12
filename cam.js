var videoElement = document.querySelector("video");
var videoSelect = document.querySelector("select#videoSource");
var stopButton = document.querySelector("button#videoStop");

var sourceIds = [];
var cnt = 0;
navigator.getUserMedia = navigator.getUserMedia ||
navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

var has_media_stream_track = true;
function gotSources(sourceInfos)
{
  for (var i = 0; i != sourceInfos.length; ++i)
  {
    var sourceInfo = sourceInfos[i];
    var option = document.createElement("option");
    option.value = sourceInfo.id;
    sourceIds.push(sourceInfo.id);

    if (sourceInfo.kind === 'video')
    {
      option.text = sourceInfo.label || 'camera ' + (videoSelect.length + 1);
      videoSelect.appendChild(option);
    }
  }
}

if (typeof MediaStreamTrack === 'undefined')
{
  alert('未対応ブラウザです');
}
else
{
  try{
    MediaStreamTrack.getSources(gotSources);
  }
  catch(e){
    console.log(e);
    has_media_stream_track = false;
  }
}


function successCallback(stream)
{
  window.stream = stream;
  videoElement.src = window.URL.createObjectURL(stream);
  
  videoElement.play();
}

function errorCallback(error)
{
  alert('未対応ブラウザです');
}

function start()
{
  //var videoSource = videoSelect.value;
  //setSource(videoSource);
  setSourceByIndex(0);
}

function changeSource(){
  cnt++;
  if(cnt==sourceIds.length){
    cnt=0;
  }
  setSource(sourceIds[cnt]);
}

function setSourceByIndex(index){
  setSource(sourceIds[index]);
}

function setSource(videoSource){
  stop();
  if(has_media_stream_track){
    var constraints = {
      video: {
        optional: [{sourceId: videoSource}]
      }
    };
  }else{
    var constraints = {video: true};
  }

  navigator.getUserMedia(constraints, successCallback, errorCallback);
}

function stop()
{
  if (!!window.stream)
  {
    videoElement.src = null;
    
    try {
      //window.stream.stop();
      window.stream.getTracks().forEach(function (track) { track.stop(); });
    }
    catch (e) {
      alert(e) // 例外オブジェクトをエラー処理部分に渡す
    }
    //window.stream.stop();

  }
}

videoSelect.onchange = 
  function(){
    start();
   
  };
stopButton.onclick = function(){
  stop();
};

start();