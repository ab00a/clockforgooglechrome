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

  var d = new Date(Date.now() + (document.offset * 1000 * 60 * 60)),
    target = document.querySelector("#theCoolDate");
  //First, let's put the full date in
  chrome.runtime.sendMessage({ type: "timeString", fmt: document.hoverFormat, d: d }, function (response) {
    target.innerHTML = response;
  });

  //Then the clock face
  paintClock(document.querySelector("#cvsClockface"), {
    colour: document.handsColour,
    ticks: 12,
    secondHand: true,
    border: true,
    numbers: true
  }, document.offset);
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (changes.alarms != null) {
      showRemindersIn(document.querySelector("#reminders"), false);
    }
  });

  chrome.storage.sync.get(["offset", "handsColour", "hoverFormat"], function (items) {
    chrome.runtime.sendMessage("regularTime"); // Forces a clock update
    var d, dp, lightness, rgb, arColour;
    d = new Date(Date.now() + (items.offset * 1000 * 60 * 60));
    document.offset = items.offset;
    document.handsColour = items.handsColour;
    document.hoverFormat = items.hoverFormat;

    //Insert the month with today's date selected
    //Create a date picker and Show it in the right place
    dp = new DatePick();
    dp.setDate(d); //Set it to today's date to begin with
    dp.appendTo("monthView");

    //The big today badge on the right uses the date format Month-Date-Year and the user preferences
    document.querySelector("#lblMonth").innerText = d.toLocaleString('default', { month: 'long' });
    document.querySelector("#lblDate").innerText = d.getDate();
    document.querySelector("#lblYear").innerText = d.getFullYear();

    //Make the user's selected colour a kind of theme
    document.querySelector("#monthDayDate>table").style.backgroundColor = items.handsColour;

    //If the hands colour is light, make the background dark
    //Color brightness is determined by the following formula:
    //((Red value X 299) + (Green value X 587) + (Blue value X 114)) / 1000
    rgb = items.handsColour.substring(items.handsColour.indexOf("(") + 1, items.handsColour.indexOf(")"));
    arColour = rgb.split(",");
    lightness = ((parseFloat(arColour[0]) * 299) + (parseFloat(arColour[1]) * 587) + (parseFloat(arColour[2]) * 114)) / 255000;
    if (lightness > 0.75) {
      document.body.setAttribute("style", "background-color: #333333;");
    }

    //Now, set the time to update every second
    updateClock();
    setInterval(updateClock, 1000);
    showRemindersIn(document.querySelector("#reminders"), false);

    //Look for sounding alarms and set the status of the mute button appropriately
    chrome.runtime.sendMessage({ type: "audioElements" }, function (response) {
      if (response == false) {
        document.querySelector("#muteIcon").style.display = "None";
        //And shift the options icon right to compensate
        document.querySelector("#optionsIcon").colSpan = 3
      }
    })
  });

  //Add a listener for when the mute button is clicked
  //It simply fires off a request to run a command in background.js
  document.querySelector("#muteIcon").addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: "silenceAlarms" });
  });
});