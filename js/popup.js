"use strict";

function updateClock() {
  chrome.runtime.getBackgroundPage(function (bkg) {
    var d = new Date(Date.now() + (document.offset * 1000 * 60 * 60)),
      target = document.querySelector("#theCoolDate");
    //First, let's put the full date in
    target.innerHTML = bkg.timeString(document.hoverFormat, d);

    //Then the clock face
    bkg.paintClock(document.querySelector("#cvsClockface"), ({
      colour: document.handsColour,
      ticks: 12,
      secondHand: true,
      border: true,
      numbers: true
    }), document.offset);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (changes.alarms != null) {
      showRemindersIn(document.querySelector("#reminders"), false);
    }
  });

  chrome.storage.sync.get(["offset", "handsColour", "hoverFormat"], function (items) {
    chrome.runtime.getBackgroundPage(function (bkg) {
      bkg.regularTime(); //forces a clock update
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

      //The big today badge on the right uses the date format from background.js and the user preferences
      document.querySelector("#lblMonth").innerText = bkg.timeString("M", d);
      //document.querySelector("#lblMonth").appendChild(bkg.timeString("M", d));
      document.querySelector("#lblDate").innerText = bkg.timeString("d", d);
      document.querySelector("#lblYear").innerText = bkg.timeString("Y", d);
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
      if (bkg.noAudioElements()) {
        document.querySelector("#muteIcon").style.display = "None";
        //And shift the options icon right to compensate
        document.querySelector("#optionsIcon").colSpan = 3
      }
    });
  });

  //Add a listener for when the mute button is clicked
  //It simply fires off a request to run a command in background.js
  document.querySelector("#muteIcon").addEventListener('click', function () {
    chrome.runtime.getBackgroundPage(function (bkg) {
      bkg.silenceAlarms();
    });
  });
});