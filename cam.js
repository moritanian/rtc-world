var videoElement = document.querySelector("video");
var videoSelect = document.querySelector("select#videoSource");
var stopButton = document.querySelector("button#videoStop");

navigator.getUserMedia = navigator.getUserMedia ||
navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

function gotSources(sourceInfos)
{
  for (var i = 0; i != sourceInfos.length; ++i)
  {
    var sourceInfo = sourceInfos[i];
    var option = document.createElement("option");
    option.value = sourceInfo.id;

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
  MediaStreamTrack.getSources(gotSources);
}


function successCallback(stream)
{
  alert("successCallback 1");
  window.stream = stream;
  videoElement.src = window.URL.createObjectURL(stream);
  alert("successCallback 2");
  
  videoElement.play();
}

function errorCallback(error)
{
  alert('未対応ブラウザです');
}

function start()
{
  alert('start 0');

  stop();
  alert('start 1');
  var videoSource = videoSelect.value;
  alert('start 2');
  var constraints = {
    video: {
      optional: [{sourceId: videoSource}]
    }
  };
  alert('start 3');

  navigator.getUserMedia(constraints, successCallback, errorCallback);
}

function stop()
{
    alert('stop 0');
  if (!!window.stream)
  {
    alert('stop 1');
    videoElement.src = null;
    alert('stop 2');
    
    try {
      window.stream.stop();
    }
    catch (e) {
      alert(e) // 例外オブジェクトをエラー処理部分に渡す
    }
    //window.stream.stop();
    alert('stop 3');

  }
}

videoSelect.onchange = 
  function(){
   // MediaStreamTrack.getSources(gotSources);
    start();
   
  };
stopButton.onclick = function(){
    alert('call stop');
  stop();
};

start();