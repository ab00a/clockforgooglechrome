"use strict";

function paintClock(cvs, options, offset) {

	//Set up the square to draw on, empty it and save this as a setting
	var d, i, size, c, ticklength, fontheight, borderwidth, tickgap, fontcent39,
		fontsize, fontcent126, seclength, sechang, minlength, minhang, hourlength,
		hourhang, secwidth, hourwidth, minwidth;
	d = new Date(Date.now() + (offset * 1000 * 60 * 60));
	size = cvs.height / 2;
	c = cvs.getContext("2d");
	c.clearRect(0, 0, 2 * size, 2 * size);
	c.save();

	//Set the origin of the drawing area to the middle
	c.translate(size, size);

	//Select the right pen colour
	c.fillStyle = options.colour;
	c.strokeStyle = options.colour;
	c.lineCap = "round"; //and a beautiful round end to the line

	//Setting up the dimensions for the clock components
	ticklength = size / 15;
	fontheight = size / 5;
	borderwidth = size / 30;
	tickgap = size / 200;
	fontcent39 = size - borderwidth - borderwidth - tickgap - ticklength - tickgap - c.measureText("9").width / 2;
	fontsize = size / 20;
	fontcent126 = size - borderwidth - borderwidth - borderwidth - tickgap - ticklength - tickgap - fontsize;
	seclength = 1.05 * (size - borderwidth - borderwidth - tickgap - ticklength);
	sechang = 0.05 * (size - borderwidth - tickgap - ticklength);
	minlength = 1.05 * (size - borderwidth - borderwidth - tickgap - ticklength);
	minhang = 0.2 * (size - borderwidth - tickgap - ticklength);
	hourlength = 0.7 * (size - borderwidth - borderwidth - tickgap - ticklength);
	hourhang = 0.15 * (size - borderwidth - tickgap - ticklength);
	secwidth = size / 100;
	minwidth = size / 25;
	if (minwidth < 2) {
		minwidth = 2;
	}
	hourwidth = size / 20;
	if (hourwidth < 2) {
		hourwidth = 2;
	}
	//If selected, draw twelve little tick marks around the edge
	if (options.numbers) {
		c.font = fontheight + "px sans-serif"; //font size should be 10% of width
		c.textAlign = "center";
		c.textBaseline = "middle";
		c.fillText("12", 0, -fontcent126);
		c.fillText("6", 0, fontcent126);
		c.fillText("9", -fontcent39, 0); //size/20 is half the height of the text
		c.fillText("3", fontcent39, 0);
	}
	if (options.ticks) {
		for (i = 0; i < options.ticks; i++) {
			c.beginPath();
			c.moveTo(0, size - borderwidth - borderwidth - tickgap);
			c.lineTo(0, size - borderwidth - borderwidth - tickgap - ticklength);
			c.stroke();
			c.rotate((2 * Math.PI) / options.ticks);
		}
	}
	if (options.secondHand) {
		//draw the second hand
		c.lineWidth = secwidth;
		c.beginPath();
		c.rotate((d.getSeconds() / 60) * 2 * Math.PI); //rotate
		c.moveTo(0, sechang);
		c.lineTo(0, -seclength);
		c.stroke();
		c.rotate((d.getSeconds() / 60) * -2 * Math.PI); //and back
	}
	//draw the minute hand
	c.lineWidth = minwidth;
	c.beginPath();
	c.rotate(((d.getMinutes() / 60 + d.getSeconds() / 3600)) * 2 * Math.PI); //rotate
	c.moveTo(0, minhang); //
	c.lineTo(0, -minlength);
	c.stroke();
	c.rotate(((d.getMinutes() / 60 + d.getSeconds() / 3600)) * -2 * Math.PI); //and back

	//draw the hour hand
	c.lineWidth = hourwidth;
	c.beginPath();
	c.rotate(((d.getHours() / 12) + (d.getMinutes() / 720)) * 2 * Math.PI);
	c.moveTo(0, hourhang);
	c.lineTo(0, -hourlength);
	c.stroke();

	if (options.border) {
		//circle around the edge
		c.beginPath();
		c.lineWidth = borderwidth;
		c.arc(0, 0, size - borderwidth, 0, 2 * Math.PI);
		c.stroke();
	}
	c.restore();
}

function updateClock() {
  paintClock(document.querySelector("#cvsClockface"), {
    colour: document.handsColour,
    ticks: 12,
    secondHand: true,
    border: true,
    numbers: true
  },
  document.offset);
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