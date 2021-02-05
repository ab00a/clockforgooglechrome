"use strict";

function updateClock() {
  chrome.runtime.getBackgroundPage(function (bkg) {
    bkg.paintClock(document.querySelector("#cvsClockface"), ({
      colour: document.handsColour,
      ticks: 12,
      secondHand: true,
      border: true,
      numbers: true
    }), document.offset);
  });
}

function windowedClock() {
  //delete the just-clicked canvas
  document.querySelector("#cvsClockface").parentNode.removeChild(document.querySelector("#cvsClockface"));
  //create a new, bigger one
  var div = document.createElement('span');
  var size = Math.min(screen.width, screen.height);
  div.innerHTML = "<canvas id='cvsClockface' height='" + size + "'width='" + size + "'></canvas>";
  //add it to the document
  document.querySelector("#basis").appendChild(div);
  //make it fullscreen
  document.querySelector("#cvsClockface").webkitRequestFullscreen();
  //and bind an event to its click
  document.querySelector("#cvsClockface").addEventListener("click", function () {
    document.webkitExitFullscreen();
  });
  //If the hands colour is light, make the background dark
  //Color brightness is determined by the following formula:
  //((Red value X 299) + (Green value X 587) + (Blue value X 114)) / 1000
  chrome.storage.sync.get(["handsColour"], function (items) {
    var rgb = items.handsColour.substring(items.handsColour.indexOf("(") + 1, items.handsColour.indexOf(")"));
    var arColour = rgb.split(",");
    var lightness = ((parseFloat(arColour[0]) * 299) + (parseFloat(arColour[1]) * 587) + (parseFloat(arColour[2]) * 114)) / 255000;
    if (lightness > 0.75) {
      document.querySelector("#cvsClockface").setAttribute("style", "background-color: #000000;");
    } else {
      document.querySelector("#cvsClockface").setAttribute("style", "background-color: #FFFFFF;");
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  //fetch details
  chrome.storage.sync.get(["offset", "handsColour"], function (items) {
    document.offset = items.offset;
    document.handsColour = items.handsColour;
    //If the hands colour is light, make the background dark
    //Color brightness is determined by the following formula:
    //((Red value X 299) + (Green value X 587) + (Blue value X 114)) / 1000
    var rgb = items.handsColour.substring(items.handsColour.indexOf("(") + 1, items.handsColour.indexOf(")"));
    var arColour = rgb.split(",");
    var lightness = ((parseFloat(arColour[0]) * 299) + (parseFloat(arColour[1]) * 587) + (parseFloat(arColour[2]) * 114)) / 255000;
    if (lightness > 0.75) {
      document.body.setAttribute("style", "background-color: #333333;");
    }
  });

  var div = document.createElement('span');
  var size = Math.min(window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth, window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight);
  size -= 10;
  div.innerHTML = "<canvas id='cvsClockface' height='" + size + "'width='" + size + "'></canvas>";
  document.querySelector("#basis").appendChild(div);
  window.setInterval(updateClock, 1000);

  //add listenerfor fullscreen change event
  document.addEventListener('webkitfullscreenchange', function () {
    if (document.webkitIsFullScreen) {
      document.querySelector("#cvsClockface").addEventListener("click", function () {
        document.webkitExitFullscreen();
      });
    } else {
      //delete the just-clicked canvas
      document.querySelector("#cvsClockface").parentNode.removeChild(document.querySelector("#cvsClockface"));
      //create a new, smaller one
      size = Math.min(window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth, window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight);
      size -= 10;
      div.innerHTML = "<canvas id='cvsClockface' height='" + size + "'width='" + size + "'></canvas>";
      document.querySelector("#basis").appendChild(div);
      document.querySelector("#cvsClockface").addEventListener("click", windowedClock);
    }
  });

  //add listener for resize event
  window.addEventListener("resize", function (e) {
    if (!document.webkitIsFullScreen) {
      document.querySelector("#cvsClockface").parentNode.removeChild(document.querySelector("#cvsClockface"));
      var div = document.createElement('span');
      var size = Math.min(window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth, window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight);
      size -= 10;
      div.innerHTML = "<canvas id='cvsClockface' height='" + size + "'width='" + size + "'></canvas>";
      document.querySelector("#basis").appendChild(div);
      document.querySelector("#cvsClockface").addEventListener("click", windowedClock);
    }
  });

  //add listener for clock click event (from non full to full)
  document.querySelector("#cvsClockface").addEventListener("click", windowedClock);
});