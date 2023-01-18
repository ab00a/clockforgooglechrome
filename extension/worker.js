"use strict";

//This is a register used to manage which alarms are actually sounding
//It is used to ensure that sounds are stopped and started correctly
var soundingAlarmsRegister = [];

// Convenient labels for alarm object fields
const ALARMTIME = 0;
const ALARMSOUND = 1;
const ALARMNAME = 2;
const ALARMREPEATDAYS = 3;
const ALARMVOLUME = 4;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	switch (request.type) {
		case "tidyReminders":
			tidyReminders();
			sendResponse("OK");
			break;
		case "timeString":
			sendResponse(timeString(request.fmt, request.d));
			break;
		case "regularTime":
			regularTime();
			sendResponse("OK");
		case "audioElements":
			sendResponse(noAudioElements());
			break;
		case "addReminder":
			addReminder(request.alarm);
			break;
		case "deleteReminder":
			deleteReminder(request.id);
			break;
		case "silenceAlarms":
			silenceAlarms();
			break;
	}

});

chrome.storage.onChanged.addListener(function (changes, area) {
	updateTime();
});

//Scans through all stored alarms, deletes ones from the past
//and recreates repeating ones for the next cycle
//and updates storage
function tidyReminders() {
	chrome.storage.sync.get(["alarms", "offset"], function (items) {
		var aldate,
			aChange = false,
			d = new Date(Date.now() + (items.offset * 1000 * 60 * 60));
		items.alarms.forEach(function (alarm, id, alarms) {
			if (alarm[ALARMTIME] < d.getTime()) {
				//It happens in the past...
				if (alarm[ALARMREPEATDAYS].indexOf(1) > -1) {
					//It's a repeater, so let's recreate it at the next repeat day (which might be today)
					//First, set the time to today, as this is the earliest possible next occurrence
					aldate = new Date(alarm[ALARMTIME]);
					aldate.setDate(d.getDate());
					aldate.setMonth(d.getMonth());
					aldate.setFullYear(d.getFullYear());
					alarm[0] = aldate.getTime();
					//while alarm is in the past or the repeat day is not in the list add one day
					while ((alarm[ALARMTIME] < d.getTime()) || (alarm[ALARMREPEATDAYS][aldate.getDay()] === 0)) {
						aldate.setDate(aldate.getDate() + 1);
						alarm[ALARMTIME] = aldate.getTime();
					}
					//reset the alarm for the new time by creating a new one
					chrome.alarms.create("a_" + alarm[ALARMNAME] + alarm[ALARMTIME], { "when": alarm[ALARMTIME] });
					aChange = true;
				} else {
					//It's not a repeater, and it's in the past, so delete it
					alarms.splice(id, 1); //delete it and hop back in the iteration
					aChange = true;
				}
			}
		});
		if (aChange) {
			chrome.storage.sync.set({ "alarms": items.alarms });
		}
		//Now we scan through each reminder in items and if there is no alarm set for it, we set one
		//This is specifically for the scenario where a reminder has been set on one computer and the alarm needs to be set up on another
		items.alarms.forEach(function (alarm, id, alarms) {
			var alarmName = "a_" + alarm[2] + alarm[0];
			chrome.alarms.get(alarmName, function (a) {
				if (a) {
					//console.log("Reminder has alarm already: " + alarmName);
				} else {
					if (typeof alarm === "undefined") {
						//this alarm has been deleted - clear it out
						tidyReminders();
					} else {
						chrome.alarms.create(alarmName, { when: items.alarm[0] });
					}
				}
			});
		});
	});
}

//Function that sets an alarm for each reminder in storage
function instantiateReminders() {
	chrome.storage.sync.get("alarms", function (items) {
		items.alarms.forEach(function (alarm, id, alarms) {
			chrome.alarms.create("a_" + alarm[2] + alarm[0], { "when": alarm[0] });
		});
	});
}

//Adds a new reminder to the store and sets an alarm for it
function addReminder(alarm) {
	chrome.storage.sync.get(["alarms", "offset"], function (items) {
		//Only add repeating reminders and ones in the future
		if (alarm[3].indexOf(1) > -1) {
			items.alarms.push(alarm);
			chrome.storage.sync.set({ "alarms": items.alarms });
			tidyReminders();
		} else {
			if (alarm[0] > (Date.now() + (items.offset * 60 * 60 * 1000))) {
				items.alarms.push(alarm);
				chrome.storage.sync.set({
					"alarms": items.alarms
				});
				chrome.alarms.create("a_" + alarm[2] + alarm[0], { "when": (alarm[0] - (items.offset * 60 * 60 * 1000)) });
			} else {
				console.log("Alarm not added because it is in the past");
			}
		}
	});
}

//Deletes a reminder and removes its alarm
function deleteReminder(alarmToDelete) {
	chrome.storage.sync.get("alarms", function (items) {
		chrome.alarms.clear("a_" + items.alarms[alarmToDelete][2] + items.alarms[alarmToDelete][0]);
		items.alarms.splice(alarmToDelete, 1);
		chrome.storage.sync.set({ "alarms": items.alarms });
	});
}

// Function to create and sound alarm audio in an offscreen document
async function offscreenAudio(audioSrc, volume = 1.0, audioType = 'soundAudio', id) {
	await chrome.offscreen.createDocument(
		{
			url: 'audio.html',
			reasons: ['AUDIO_PLAYBACK'],
			justification: 'Play alarm and chime sounds in an offscreen document'
		},
		function (n) {
			chrome.runtime.sendMessage({
				'type': audioType,
				'audioSrc': audioSrc,
				'volume': volume,
				'id': id
			});
		});
}

// Function which shows the notification for an alarm
function soundAlarm(alarmName) {
	chrome.storage.sync.get(["alarms", "offset", "handsColour", "hoverFormat"], function (items) {
		// Find the alarm that is sounding now and make it thisReminder
		var thisReminder;
		items.alarms.forEach(function (item, id, items) {
			if ("a_" + item[2] + item[0] === alarmName) {
				thisReminder = item;
			}
		});
		//TODO: add a check here to ensure thisReminder is correctly populated

		//Create the notification itself
		chrome.notifications.create(
			"", //Let the NotificationId be automatically generated
			{
				type: "basic",
				title: thisReminder[2],
				message: timeString(items.hoverFormat, new Date(thisReminder[0])),
				requireInteraction: true,
				iconUrl: "/assets/icon128.png",
				buttons: [
					{
						title: "Snooze",
						iconUrl: "/assets/icon16.png"
					},
					{
						title: "Close",
						iconUrl: "/assets/delete.png"
					}
				]
			},
			function (id) {
				// Notification is created. Make a noise, if a noise is set
				/*https://chromium.googlesource.com/chromium/src/+/2dd7435aa7d6143bb263032dcf52bf3ac995d94c/chrome/test/data/extensions/api_test/offscreen/create_document/background.js*/
				//Play the sound in a loop
				if (thisReminder[ALARMSOUND] != "nothing") { // Only do something if the alarm has a sound
					//link the notification with the alarm for snooze and silence purposes
					soundingAlarmsRegister.push({
						identifier: id,
						alarm: thisReminder
					});
					// Set the volume from the stored value (if there is one)
					var vol = 1.0;
					if (typeof thisReminder[ALARMVOLUME] != "undefined") {
						vol = parseFloat(thisReminder[ALARMVOLUME]);
					}
					offscreenAudio(thisReminder[ALARMSOUND] + ".ogg", vol, "soundAudio", id);
				}
			}
		);
	});
	tidyReminders();
}


// Function that returns imageData of <height> x <width> according to <options> and with offset <offset>
function getClockImage(height, width, options, offset) {
	const cvs = new OffscreenCanvas(height, width);
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

	return c.getImageData(0, 0, width, height);
}

//Converts a date object into a string based on a string mask
function timeString(fmt, d) {
	if (typeof (d) == "string") {
		d = new Date(d);
	}
	var curr_date, curr_month, curr_year, hours, minutes, seconds, meri,
		sDate, ln, i;

	curr_date = d.getDate();
	curr_month = d.getMonth();
	curr_year = d.getFullYear();
	hours = d.getHours();

	if (hours >= 12) {
		hours -= 12;
		meri = "pm";
	} else {
		meri = "am";
	}
	if (hours === 0) {
		hours = 12;
	}

	minutes = d.getMinutes();
	if (String(minutes).length === 1) {
		minutes = "0" + String(minutes);
	}

	seconds = d.getSeconds();
	if (String(seconds).length === 1) {
		seconds = "0" + String(seconds);
	}

	//Loop through each item in the format to build the string
	sDate = "";
	ln = fmt.length;
	for (i = 0; i < ln; i++) {
		//Original characters
		//t=12 T=24 a=am D=wordDay d=noDay e=2digitDay s=/ M=wordMonth m=noMonth y=yy Y=yyyy
		//Additional characters now permitted
		//j (same as d), l (same as D), S (st, nd, rd or th)
		//J (first three characters of day)
		//N (first three characters of month)
		//n (same as m)
		//A (AM/PM)
		//g (12h hour, no leading zero), G (24h hour, no leading zero),
		//h (12h hour, leading zero), H (24h hour, leading zero), i (minute, leading zero)
		//x (seconds, leading zero)
		//\ (ignore next character)
		//Anything else, show as is
		switch (fmt.charAt(i)) {
			case "\\":
				i++;
				sDate += fmt.charAt(i);
				break;
			case "S":
				switch (parseInt(curr_date, 10) % 10) {
					case 1:
						if (curr_date === 11) {
							sDate += "th";
						} else {
							sDate += "st";
						}
						break;
					case 2:
						if (curr_date === 12) {
							sDate += "th";
						} else {
							sDate += "nd";
						}
						break;
					case 3:
						if (curr_date === 13) {
							sDate += "th";
						} else {
							sDate += "rd";
						}
						break;
					default:
						sDate += "th";
				}
				break;
			case "t":
				sDate += hours + ":" + minutes;
				break;
			case "g":
				sDate += hours;
				break;
			case "h":
				if (String(hours).length < 2) {
					sDate += "0";
				}
				sDate += hours;
				break;
			case "i":
				sDate += minutes;
				break;
			case "x":
				sDate += seconds;
				break;
			case "H":
				if (String(d.getHours()).length < 2) {
					sDate += "0";
				}
				sDate += d.getHours();
				break;
			case "G":
				sDate += d.getHours();
				break;
			case "T":
				if (String(d.getHours()).length < 2) {
					sDate += "0";
				}
				sDate += d.getHours() + ":" + minutes;
				break;
			case "a":
				sDate += meri;
				break;
			case "A":
				sDate += meri.toUpperCase();
				break;
			case "s":
				sDate += "/";
				break;
			case "l":
			case "D":
				sDate += d.toLocaleString('default', { weekday: 'long' });
				break;
			case "J":
				sDate += d.toLocaleString('default', { weekday: 'short' });
				break;
			case "j":
			case "d":
				sDate += curr_date;
				break;
			case "e":
				if (String(curr_date).length < 2) {
					sDate += "0";
				}
				sDate += curr_date;
				break;
			case "M":
				sDate += d.toLocaleString('default', { month: 'long' });
				break;
			case "N":
				sDate += d.toLocaleString('default', { month: 'short' });
				break;
			case "n":
			case "m":
				if (String(curr_month + 1).length < 2) {
					sDate += "0";
				}
				sDate += (curr_month + 1);
				break;
			case "Y":
				sDate += curr_year;
				break;
			case "y":
				sDate += String(curr_year).substring(2);
				break;
			default:
				sDate += fmt.charAt(i);
				break;
		}
	}
	return sDate;
}

//A key function, it updates the clock. It's called once a minute and on any change from the options page
// It is also fired on any changes to the sync store
// i.e. When an option is changed
function updateTime() {
	chrome.storage.sync.get(null, function (items) {
		var d, ctx, x, y, width, height, radius;
		d = new Date(Date.now() + (items.offset * 1000 * 60 * 60) + 1000); //that last 1000 is to make sure there are no on the minute edge cases

		if (items.showDigital && items.showAnalogue) {
			var hours, minutes, fill, badgeColour;
			//The analogue and digital clocks are required, so show the badge
			//First build the 4 character string to put in
			minutes = d.getMinutes();
			if (minutes < 10) {
				minutes = "0" + minutes;
			}
			fill = "";
			hours = d.getHours();
			if ((hours > 12) && (items.hoverFormat.indexOf("t") > -1)) {
				hours -= 12;
			}
			if ((hours + "").length < 2) {
				fill = ":";
			}
			//Set the badge colour
			badgeColour = items.badgeColour.split(",");
			badgeColour.forEach(function (element, id, badgeColour) {
				badgeColour[id] = Number(element);
			});
			chrome.action.setBadgeBackgroundColor({
				color: badgeColour
			});
			//and show the badge
			chrome.action.setBadgeText({ text: hours + fill + minutes });
		} else {
			//We don't want the badge, so set it nothing
			chrome.action.setBadgeText({ text: "" });
		}

		//For each canvas resize it according to its location in the array
		//Take the position, add one and multiply by 19
		//Then draw a clock in it!

		//Create a canvas for each scale
		var canvases = [new OffscreenCanvas(19, 19), new OffscreenCanvas(38, 38)];

		canvases.forEach(function (canvas, id, canvases) {
			ctx = canvas.getContext("2d");

			if (items.showAnalogue === true) {
				//Draw a new clock
				canvas.getContext('2d').putImageData(getClockImage(canvas.height,
					canvas.width, {
					colour: items.handsColour,
					ticks: items.dots,
					secondHand: false,
					border: false,
					numbers: false
				},
					items.offset), 0, 0);
			} else {
				if (items.showDigital) {
					//No analogue, only digital, so let's fill the space
					x = 0;
					y = 0;
					width = canvas.width;
					height = canvas.height;
					radius = canvas.width * 0.15;

					ctx.beginPath();
					ctx.moveTo(x + radius, y);
					ctx.lineTo(x + width - radius, y);
					ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
					ctx.lineTo(x + width, y + height - radius);
					ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
					ctx.lineTo(x + radius, y + height);
					ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
					ctx.lineTo(x, y + radius);
					ctx.quadraticCurveTo(x, y, x + radius, y);
					ctx.closePath();

					ctx.fillStyle = "rgba(" + items.badgeColour.split(",")[0]
						+ ", " + items.badgeColour.split(",")[1]
						+ ", " + items.badgeColour.split(",")[2]
						+ ", " + parseInt(items.badgeColour.split(",")[3], 10) / 255
						+ ")";
					ctx.fill();
					//Then write the time within this rectangle
					ctx.font = "bold " + (height / 2) + "px sans-serif"; //font size should be half as high as the box
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillStyle = "rgba(" + items.digitalForeColour.split(",")[0]
						+ ", " + items.digitalForeColour.split(",")[1]
						+ ", " + items.digitalForeColour.split(",")[2]
						+ ", " + parseInt(items.digitalForeColour.split(",")[3], 10) / 255
						+ ")";
					minutes = d.getMinutes();
					if (minutes < 10) {
						minutes = "0" + minutes;
					}
					fill = "";
					hours = d.getHours();
					if ((hours > 12) && (items.hoverFormat.indexOf("t") > -1)) {
						hours -= 12;
					}
					ctx.fillText(hours, x + canvas.width / 2, height / 4);
					ctx.fillText(minutes, x + canvas.width / 2, y + height / 1.33);
				} else {
					//No analogue and no Linux digital so no image on the canvas
					ctx.clearRect(0, 0, canvas.height, canvas.width);
				}
			}
		});
		//Write the clock to the toolbar
		chrome.action.setIcon(
			{
				imageData:
				{
					"19": canvases[0].getContext("2d").getImageData(0, 0, canvases[0].height, canvases[0].width),
					"38": canvases[1].getContext("2d").getImageData(0, 0, canvases[1].height, canvases[1].width)
				}
			}
		);

		//Update the hover text
		chrome.action.setTitle({ title: timeString(items.hoverFormat, d) });
	});
}

function soundChime() {
	chrome.storage.sync.get(["hourVolume"], function (items) {
		var vol = 1.0;
		if (typeof items.hourVolume != "undefined") {
			vol = items.hourVolume;
		}
		offscreenAudio('assets/diing.ogg', vol, 'chime', 'chime');
	});
}

function setUpdateAlarm() {
	var d, msDelay;
	d = new Date();
	msDelay = 120001 - ((d.getSeconds() * 1000) + (d.getMilliseconds())); //the delay needs to be >60s to fire at the right time
	chrome.alarms.create("___minute", { "when": Date.now() + msDelay, "periodInMinutes": 1 });
}

function regularTime() {
	var d;
	updateTime();
	d = new Date();
	if (d.getSeconds() > 5) {
		setUpdateAlarm(); //update has drifted so let's reset the timer
	}
	chrome.storage.sync.get(["hourChime"], function (items) {
		if (items.hourChime > 0) {
			switch (d.getMinutes()) {
				case 0:
					soundChime();
					break;
				case 15:
				case 45:
					if (items.hourChime === 4) {
						soundChime();
					}
					break;
				case 30:
					if (items.hourChime > 1) {
						soundChime();
					}
					break;
			}
		}
	});
}

//Run on first run, this resets all the preferences to defaults
function setupPreferences() {
	chrome.storage.sync.set({
		"handsColour": "rgba(0,0,0,0.4)",
		"showDigital": false,
		"badgeColour": "0,0,0,50",
		"hoverFormat": "ta D d M Y",
		"firstDay": 0,
		"showAnalogue": true,
		"dots": 0,
		"offset": 0.0,
		"hourChime": false,
		"hourVolume": 1.0,
		"digitalForeColour": "255,255,255,255",
		"alarms": []
	}, function (items) {
		// Once set, start things up
		startup();
	}
	);
}

//This sets everything up and is run at start up
function startup() {

	// Make sure expired alarms don't sound early
	tidyReminders();

	// Start the clock and set up the regular reminders
	regularTime();
	setUpdateAlarm();

}

chrome.runtime.onStartup.addListener(startup);

//Run on first install and upgrades
chrome.runtime.onInstalled.addListener(function () {
	//if there's nothing in storage, set defaults
	chrome.storage.sync.getBytesInUse(null, function (len) {
		if (len < 1) {
			setupPreferences();
		}
	});
	startup();
});

//Function used by popup.js to find out if there are any sounds active at the moment
function noAudioElements() {
	return soundingAlarmsRegister.length
}

//Called from the silence button in popup.html
//Finds, stops and deletes all audio elements by closing the offscreen page
//Then clears the sounding register and calls tidyreminders
async function silenceAlarms() {
	chrome.offscreen.closeDocument();
	soundingAlarmsRegister = null;
	tidyReminders();
}

//the page has been woken up, so update the clock
//and register listeners
//When an alarm sounds, use the alarm handler
chrome.alarms.onAlarm.addListener(function (alarm) {
	switch (alarm.name) {
		case "___minute":
		case "___unblock":
			regularTime();
			break;
		default:
			soundAlarm(alarm.name);
			break;
	}
});

//Set up handlers for notification closes
chrome.notifications.onClosed.addListener(function (notificationId, byUser) {
	chrome.offscreen.closeDocument();
	tidyReminders();
});

//Set up handlers for notification button clicks
chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {

	soundingAlarmsRegister.forEach(function (item, id, items) {

		if (item.identifier === notificationId) {
			//Stop the sound
			if (item.alarm[ALARMSOUND] != "nothing") { //This Reminder has NOISE so we must stop it
				chrome.runtime.sendMessage({
					'type': 'stopAudio',
					'id': item.identifier
				});
			}

			if (buttonIndex === 0) {
				//SNOOZE!!
				item.alarm[ALARMTIME] = (Date.now() + 300000); //set a new alarm five minutes from now
				item.alarm[ALARMREPEATDAYS] = [0, 0, 0, 0, 0, 0, 0]; //snoozed alarms should not be repeaters, only one-offs
				item.alarm[ALARMNAME] = "[Zzz] " + item.alarm[2];
				addReminder(item.alarm);
			}

			//CLOSE the notification
			chrome.notifications.clear(notificationId, function (wasCleared) {
			});
		}
	});
});

