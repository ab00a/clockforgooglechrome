"use strict";

//This is a register used to manage which alarms are actually sounding
//It is used to ensure that sounds are stopped and started correctly
var activeNotificationsRegister = [];

// Convenient labels for alarm object fields
const ALARMTIME = 0;
const ALARMSOUND = 1;
const ALARMNAME = 2;
const ALARMREPEATDAYS = 3;
const ALARMVOLUME = 4;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	switch (request.type) {
		case "timeString":
			sendResponse(timeString(request.fmt, request.d));
			break;
		case "regularTime":
			regularTime();
			sendResponse("OK");
			break;
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

// Function used to respond to alarm fired events
// If it's the regular update, fire the clock
// Otherwise sound the alarm
async function alarmHandler(alarm) {
	switch (alarm.name) {
		case "___minute":
			regularTime();
			break;
		default:
			await soundAlarm(alarm.name);
	}
}

//the page has been woken up, so update the clock
//and register listeners
//When an alarm sounds, use the alarm handler
chrome.alarms.onAlarm.addListener(alarmHandler);

//Function that iterates through every Reminder in storage and deletes non-repeating ones that happen in the past
async function purgeStaleReminders() {
	let storedReminders = await chrome.storage.sync.get(["alarms", "offset"]); //Collect Reminders from storage
	let d = new Date(Date.now() + (storedReminders.offset * 1000 * 60 * 60)); // Work out when expired is
	let newReminders = storedReminders.alarms.filter((reminder) => ((reminder[ALARMTIME] > d.getTime()) || (reminder[ALARMREPEATDAYS].indexOf(1) > -1))); // Iterate through each reminder
	await chrome.storage.sync.set({ "alarms": newReminders }); // Store the updated (shorter) list of reminders
}

// Function which creates the right alarms for repeating Reminders
async function createRepeatingAlarms() {
	let storedReminders = await chrome.storage.sync.get(["alarms", "offset"]); 	//Collect Reminders from storage
	storedReminders.alarms.forEach(function (reminder, id, reminders) {
		if (reminder[ALARMREPEATDAYS].indexOf(1) > -1) {
			//It's a repeater, so let's recreate it at the next repeat day (which might be today)
			//First, set the time to today, as this is the earliest possible next occurrence
			let aldate = new Date(reminder[ALARMTIME]);
			let d = new Date(Date.now() + (storedReminders.offset * 1000 * 60 * 60));
			aldate.setDate(d.getDate());
			aldate.setMonth(d.getMonth());
			aldate.setFullYear(d.getFullYear());
			reminder[ALARMTIME] = aldate.getTime();
			//while next alarm time is in the past or the repeat day is not in the list add one day
			while ((reminder[ALARMTIME] < d.getTime()) || (reminder[ALARMREPEATDAYS][aldate.getDay()] === 0)) {
				aldate.setDate(aldate.getDate() + 1);
				reminder[ALARMTIME] = aldate.getTime();
			}
			//Create an alarm for the new time by creating a new one
			chrome.alarms.create("a_" + reminder[ALARMNAME] + reminder[ALARMTIME], { "when": reminder[ALARMTIME] });
		}
	});
	// Update the alarm time set in the store
	await chrome.storage.sync.set({ "alarms": storedReminders.alarms });
}

// Function that iterates through all the alarms that are set in the browser and removes those that do not have
// a correlating Reminder
async function removeOrphanAlarms() {
	let alarms = await chrome.alarms.getAll();
	let reminders = await chrome.storage.sync.get("alarms");
	alarms.forEach(function (alarm, id, alarms) {
		// Need to iterate through each alarm and try to match it with a reminder
		if (alarm.name.startsWith("a_")) { //It's an alarm associated with a reminder, so let's deal with it
			let inferredReminderName = alarm.name.replace("a_", "");
			inferredReminderName = inferredReminderName.replace(alarm.scheduledTime, ""); //Extracting the reminder name from the alarm
			// Filter the reminders array for those that both
			//	a) Match the name of the alarm in question
			/// b) Match the time of the alarm in question
			const matchingReminders = reminders.alarms.filter((reminder) => ((reminder[ALARMNAME] === inferredReminderName) && (reminder[ALARMTIME] === alarm.scheduledTime)));
			if (matchingReminders.length < 1) { // If the number of returned results is less than 1
				chrome.alarms.clear(alarm.name); //Remove the alarm
			}
		}
	});
}

//Function that sets an alarm for each reminder in storage
async function createOneOffAlarms() {
	let items = await chrome.storage.sync.get("alarms");
	items.alarms.forEach(function (reminder, id, reminders) {
		if (reminder[ALARMREPEATDAYS].indexOf(1) == -1) {
			chrome.alarms.create("a_" + reminder[ALARMNAME] + reminder[ALARMTIME], { "when": reminder[ALARMTIME] });
		}
	});
}

//Adds a new reminder to the store and sets an alarm for it
async function addReminder(reminder) {
	let items = await chrome.storage.sync.get(["alarms", "offset"]);
	// Add a random 0-999ms delay to stop simultaneous alarms firing HACK
	reminder[ALARMTIME] = reminder[ALARMTIME] + Math.floor(1000 * Math.random());
	//Only add repeating reminders and ones in the future
	if (reminder[ALARMREPEATDAYS].indexOf(1) > -1) {
		items.alarms.push(reminder);
		await chrome.storage.sync.set({ "alarms": items.alarms });
		createRepeatingAlarms();
	} else {
		if (reminder[ALARMTIME] > (Date.now() + (items.offset * 60 * 60 * 1000))) {
			items.alarms.push(reminder);
			await chrome.storage.sync.set({ "alarms": items.alarms });
			chrome.alarms.create("a_" + reminder[ALARMNAME] + reminder[ALARMTIME], { "when": (reminder[ALARMTIME] - (items.offset * 60 * 60 * 1000)) });
		} else {
			console.log("Alarm not added because it is in the past");
		}
	}
}

//Deletes a reminder and removes its alarm
async function deleteReminder(alarmToDelete) {
	let items = await chrome.storage.sync.get("alarms");
	items.alarms.splice(alarmToDelete, 1);
	await chrome.storage.sync.set({ "alarms": items.alarms });
	removeOrphanAlarms();
}

// Hacky utility function which is used to inject a small delay where required to avoid async clashes
// The only parameter is the maximum delay in msDelay
// If the parameter is omitted, the delay is 500ms
function randomPause(maxDelay = 500) {
	const delayed = Math.floor(Math.random() * maxDelay);
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(delayed);
		}, delayed);
	});
}

// Function to create and sound alarm audio in an offscreen document
async function offscreenAudio(audioSrc, volume = 1.0, audioType = "soundAudio", id) {
	// Bit hacky because odd stuff happens if this is invoked twice at exactly the same time
	await randomPause(1000);
	let hasOffscreen = await chrome.offscreen.hasDocument();
	if (!hasOffscreen) { // No offscreen document exists, so let's create it
		try {
			await chrome.offscreen.createDocument(
				{
					url: "audio.html",
					reasons: ['AUDIO_PLAYBACK'],
					justification: "Play alarm and chime sounds in an offscreen document"
				});
		} catch (e) {
			console.log("Failed to create an offscreen document: " + e);
		}
	}
	// Now the offscreen document exists so we can send the message to fire the audio
	chrome.runtime.sendMessage({
		"type": audioType,
		"audioSrc": audioSrc,
		"volume": volume,
		"id": id
	});
}

// Function which shows the notification for an alarm
async function soundAlarm(alarmName) {
	let items = await chrome.storage.sync.get(["alarms", "offset", "handsColour", "hoverFormat"]);
	// Find the alarm that is sounding now and make it thisReminder
	let thisReminder = items.alarms.find((reminder) => ("a_" + reminder[ALARMNAME] + reminder[ALARMTIME] === alarmName))

	if (thisReminder != undefined) { //If no reminder has been located, just stop and do nothing

		//Create the notification itself
		chrome.notifications.create(
			"", //Let the NotificationId be automatically generated
			{
				type: "basic",
				title: thisReminder[ALARMNAME],
				message: timeString(items.hoverFormat, new Date(thisReminder[ALARMTIME])),
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
				// Notification is created. 
				//link the notification with the alarm for snooze and silence purposes
				activeNotificationsRegister.push({
					identifier: id,
					alarm: thisReminder
				});

				//Make a noise, if a noise is set. Play the sound in a loop
				if (thisReminder[ALARMSOUND] != "nothing") { // Only do something if the alarm has a sound

					// Set the volume from the stored value (if there is one)
					let vol = 1.0;
					if (typeof thisReminder[ALARMVOLUME] !== "undefined") {
						vol = parseFloat(thisReminder[ALARMVOLUME]);
					}
					offscreenAudio(thisReminder[ALARMSOUND] + ".ogg", vol, "soundAudio", id);
				}
			}
		);
		if (thisReminder[ALARMREPEATDAYS].indexOf(1) > -1) {  	// If this is a repeater
			createRepeatingAlarms();							// Add the next iteration
		}
	} else {
		// No reminder was found, so somenthing is out of sync, let's fix that
		removeOrphanAlarms();
	}
}

// Function that returns imageData of <height> x <width> according to <options> and with offset <offset>
function getClockImage(height, width, options, offset) {
	const cvs = new OffscreenCanvas(height, width);
	//Set up the square to draw on, empty it and save this as a setting
	let d, i, size, c, ticklength, fontheight, borderwidth, tickgap, fontcent39,
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
	let curr_date, curr_month, curr_year, hours, minutes, seconds, meri,
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
		}
	}
	return sDate;
}

//A key function, it updates the clock. It's called once a minute and on any change from the options page
// It is also fired on any changes to the sync store
// i.e. When an option is changed
async function updateTime() {
	let items = await chrome.storage.sync.get(null);
	let d, ctx, x, y, width, height, radius;
	d = new Date(Date.now() + (items.offset * 1000 * 60 * 60) + 1000); //that last 1000 is to make sure there are no on the minute edge cases

	if (items.showDigital && items.showAnalogue) {
		let hours, minutes, fill, badgeColour;
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
		if (String(hours).length < 2) {
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
				let minutes = d.getMinutes();
				if (minutes < 10) {
					minutes = "0" + minutes;
				}
				let hours = d.getHours();
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
}

async function soundChime() {
	let items = await chrome.storage.sync.get(["hourVolume"]);
	let vol = 1.0;
	if (typeof items.hourVolume != "undefined") {
		vol = items.hourVolume;
	}
	await offscreenAudio("assets/diing.ogg", vol, "chime", "chime");
}

function setUpdateAlarm() {
	let d = new Date();
	let msDelay = 120001 - ((d.getSeconds() * 1000) + (d.getMilliseconds())); //the delay needs to be >60s to fire at the right time
	msDelay += Math.floor(500 * Math.random()); // Addition of 0-499ms delay to avoid simultaneous alarms firing and causing Chrome alarm handlers to get confused
	chrome.alarms.create("___minute", { "when": Date.now() + msDelay, "periodInMinutes": 1 });
}

async function regularTime() {
	updateTime();
	let d = new Date();
	if (d.getSeconds() > 5) {
		setUpdateAlarm(); //update has drifted so let's reset the timer
	}
	let items = await chrome.storage.sync.get(["hourChime"]);
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
}

//Run on first run, this resets all the preferences to defaults
async function setupPreferences() {
	await chrome.storage.sync.set({
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
	});
}

//This sets everything up and is run at start up
async function startup() {

	// Make sure expired reminders don't sound early
	await purgeStaleReminders();

	// Set up chrome alarms for set reminders
	await createOneOffAlarms();
	await createRepeatingAlarms();

	// Start the clock and set up the regular reminders
	setUpdateAlarm();
	regularTime();
}

chrome.runtime.onStartup.addListener(startup);

//Run on first install and upgrades
chrome.runtime.onInstalled.addListener(async function () {
	//if there's nothing in storage, set defaults
	let len = await chrome.storage.sync.getBytesInUse(null);
	if (len < 1) {
		await setupPreferences();
	} else {
		await startup();
	}
});

//Function used by popup.js to find out if there are any sounds active at the moment
function noAudioElements() {
	const activeSoundingAlarms = activeNotificationsRegister.filter((reminder) => (reminder[ALARMSOUND] !== "nothing"));
	return activeSoundingAlarms.length;
}

//Called from the silence button in popup.html
//Finds, stops and deletes all audio elements by closing the offscreen page
//Then clears the sounding register
async function silenceAlarms() {
	let hasOffscreen = await chrome.offscreen.hasDocument();
	if (hasOffscreen) {
		chrome.offscreen.closeDocument();
	}
}

//Set up handlers for notification button clicks
chrome.notifications.onButtonClicked.addListener(async function (notificationId, buttonIndex) {
	// Look up the reminder in the active alarms register for this notification
	const thisReminderIndex = activeNotificationsRegister.findIndex((notification) => (notification.identifier === notificationId));

	if (thisReminderIndex > -1) {
		if (activeNotificationsRegister[thisReminderIndex].alarm[ALARMSOUND] !== "nothing") {
			//Stop the sound
			chrome.runtime.sendMessage({
				"type": "stopAudio",
				"id": activeNotificationsRegister[thisReminderIndex].identifier
			});
		}

		// Delete the reminder
		// Find the index of the reminder to delete
		let items = await chrome.storage.sync.get("alarms");
		const indexOfReminderToDelete = items.alarms.findIndex((reminder) => (reminder[ALARMNAME] === activeNotificationsRegister[thisReminderIndex].alarm[ALARMNAME]));
		if (indexOfReminderToDelete > -1) {
			await deleteReminder(indexOfReminderToDelete);
		}

		if (buttonIndex === 0) {
			//SNOOZE - create a new reminder
			activeNotificationsRegister[thisReminderIndex].alarm[ALARMTIME] = (Date.now() + 300000); 		//set a new alarm five minutes from now
			activeNotificationsRegister[thisReminderIndex].alarm[ALARMREPEATDAYS] = [0, 0, 0, 0, 0, 0, 0]; 	//snoozed alarms should not be repeaters, only one-offs
			activeNotificationsRegister[thisReminderIndex].alarm[ALARMNAME] = "[Zzz] " + activeNotificationsRegister[thisReminderIndex].alarm[ALARMNAME];
			await addReminder(activeNotificationsRegister[thisReminderIndex].alarm);
		}

	} else {
		console.log("ERROR: Notification ID does not match any registered active reminders");
		// There is a non-zero risk that the activeNotificationsRegister gets out of sync because of service worker sleeping
		// So if we reach this state, we stop ALL audio to prevent unstoppable noises
		silenceAlarms();
		//Although windows notifications may still be active, so we'll need to leave activeNotificationsRegister
		//as is in case a snooze is required. Risk here that snoozes may not work on open notifications though
	}

	chrome.notifications.clear(notificationId); 				// CLOSE the notification
	activeNotificationsRegister.splice(thisReminderIndex, 1); 	// Remove from the register
});
