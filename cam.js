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
  stop();

  var videoSource = videoSelect.value;
  var constraints = {
    video: {
      optional: [{sourceId: videoSource}]
    }
  };
  navigator.getUserMedia(constraints, successCallback, errorCallback);
}

function stop()
{
  if (!!window.stream)
  {
    videoElement.src = null;
    window.stream.stop();
  }
}

videoSelect.onchange = start;
stopButton.onclick = stop;

start();