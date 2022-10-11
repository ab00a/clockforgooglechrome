"use strict";

//function that takes the current value of an HTML5 color input
//as a string "#hhhhhh" and returns a string
//"r255,g255,b255"
function hexToRGB(hex) {
    return parseInt(hex.substr(1, 2), 16) + "," + parseInt(hex.substr(3, 2), 16) + "," + parseInt(hex.substr(5, 2), 16);
}

//function that shows or hides the digitalForeColour picker controls
//They are only shown if the digital clock only is shown
//In all other cases, they are hidden
function showHideDigitalForeTextPickerControls() {
    chrome.storage.sync.get(["showAnalogue", "showDigital"], function (items) {
        if (items.showDigital && !(items.showAnalogue)) {
            document.querySelector("#digitalFore").style.display = "inline";
        } else {
            document.querySelector("#digitalFore").style.display = "none";
        }
    });
}

//Handler for when the digital clock colour picker is used
//Updates the value and updates the clock
function badgeColourChange(e) {
    chrome.storage.sync.set({ "badgeColour": hexToRGB(document.querySelector("#badgePicker").value) + "," + document.querySelector("#badgeA").value });
}

//Handler for when the digital clock foreground colour picker is used
//Updates the value and updates the clock
function digitalColourChange(e) {
    chrome.storage.sync.set({ "digitalForeColour": hexToRGB(document.querySelector("#digitalPicker").value) + "," + document.querySelector("#digitalPickerA").value });
}

//Handler for when the select list is changed for the first day of the week
//Updates the stored value only
function changeFirstDay(e) {
    chrome.storage.sync.set({ "firstDay": e.currentTarget.options[e.currentTarget.selectedIndex].value });
}

//Handler for when the Hour Chime image is clicked
//Cycles through the available values
function changeHourChime(e) {
    //do a cycle through 0,1,2,4
    switch (e.currentTarget.getAttribute("data-value")) {
        case "0":
            document.querySelector("#hourChime").src = "../assets/onechime.png";
            document.querySelector("#hourChime").setAttribute("data-value", "1");
            break;
        case "1":
            document.querySelector("#hourChime").src = "../assets/twochimes.png";
            document.querySelector("#hourChime").setAttribute("data-value", "2");
            break;
        case "2":
            document.querySelector("#hourChime").src = "../assets/fourchimes.png";
            document.querySelector("#hourChime").setAttribute("data-value", "4");
            break;
        case "4":
            document.querySelector("#hourChime").src = "../assets/nochimes.png";
            document.querySelector("#hourChime").setAttribute("data-value", "0");
            break;
        default:
            document.querySelector("#hourChime").src = "../assets/nochimes.png";
            document.querySelector("#hourChime").setAttribute("data-value", "0");
            break;
    }
    //then set the value
    chrome.storage.sync.set({ "hourChime": parseInt(document.querySelector("#hourChime").getAttribute("data-value")) });
}

//Handler for when the Hour Volume slider is changed
//Updates the stored value and rings at the selected volume
function changeHourVolume(e) {
    chrome.storage.sync.set({ "hourVolume": e.currentTarget.value });
    document.querySelector("#hourChimeSample").volume = e.currentTarget.value;
    document.querySelector("#hourChimeSample").pause();
    document.querySelector("#hourChimeSample").currentTime = 0;
    document.querySelector("#hourChimeSample").play();
}

//Handler for when the offset is changed for the change to the current time
//Updates the stored value and updates the clock
function changeOffset(e) {
    chrome.storage.sync.set({ "offset": e.currentTarget.value });
}

//Handler for when the date is chosen
//Ensures the right radio button is selected
function customDatePicked(e) {
    document.querySelector("#datePickerCustom").checked = true;
}

//Handler for when the date format is changed
//Shows and hides the right bits and updates the clock
function dateFormatChange(e) {
    if ((e.currentTarget === document.querySelector("#hoverTextCustom")) || (e.currentTarget === document.querySelector("#hoverTextCustomFormat"))) {
        //Show the box
        document.querySelector("#hoverTextCustomFormat").style.display = "inline";
        //fill the box with this value
        document.querySelector("#hoverTextCustomFormat").value = e.currentTarget.value;
    } else {
        document.querySelector("#hoverTextCustomFormat").style.display = "none";
    }
    chrome.storage.sync.set({ "hoverFormat": e.currentTarget.value });
}

//Handler for when the custom date format radio button is chosen
//Updates the date with the current contents of the box
function customDateFormatChange(e) {
    document.querySelector("#hoverTextCustom").checked = true;
    document.querySelector("#hoverTextCustom").value = e.currentTarget.value;
    chrome.storage.sync.set({ "hoverFormat": e.currentTarget.value });
}

//Handler for changing the clock visibility
function clockSwitch(e) {
    chrome.storage.sync.set({ "showAnalogue": e.currentTarget.checked });
    if (e.currentTarget.checked) {
        document.querySelector("#dotsSelection").style.display = "inline";
    } else {
        document.querySelector("#dotsSelection").style.display = "none";
    }
    showHideDigitalForeTextPickerControls();
}

//Handler for changing the number of marker dots on the little clock
function dotsSwitch(e) {
    chrome.storage.sync.set({ "dots": parseInt(e.currentTarget.value, 10) });
}

//Handler for changing the colour of the hands
//Changes the colour and hides the colour picker
function handsColourChange(e) {
    document.querySelector("#handsPickerDiv").style.display = "none";
    chrome.storage.sync.set({ "handsColour": e.currentTarget.value });
}

//Handler for changing the hands to a custom colour
//Parses the value of the picker appropriately, stores it and updates the clock
function handsColourCustomChange(e) {
    var handsColour = "rgba(";
    handsColour += hexToRGB(document.querySelector("#handsPicker").value) + "," + document.querySelector("#handsA").value / 100;
    handsColour += ")";
    chrome.storage.sync.set({ "handsColour": handsColour });
}

//Utility functions for determining whether summer time is in force
Date.prototype.stdTimezoneOffset = function () {
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

Date.prototype.dst = function () {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
};

//Handler for the add reminder button
//Takes various input elements from the page
//Adds an element to the reminders list
//Fires the housekeeping
function addNewAlarm(e) {
    var i, alarm, alarmtime;
    alarm = [];
    alarm[4] = document.querySelector("#reminderVolume").value;
    alarm[3] = [];
    alarm[2] = document.querySelector("#newAlarmLabel").value;
    alarm[1] = document.querySelector("#newAlarmRing").value;
    alarm[0] = document.dp.selectedDate;

    alarmtime = document.querySelector("#selectedTime").value.split(":");

    alarm[0].setHours(parseInt(alarmtime[0]));
    alarm[0].setMinutes(parseInt(alarmtime[1]));
    alarm[0].setSeconds(0);
    alarm[0].setMilliseconds(0);
    if (document.querySelector("#repeatNewAlarm").checked == true) {
        alarm[0].setTime(alarm[0].setFullYear(2020));
        //this artificially sets a repeating alarm to happen in the past
        //so that the housekeeping logic will run on it
        //and correctly set the first run time
    }
    alarm[0] = alarm[0].getTime();
    for (i = 0; i < 7; i++) {
        alarm[3][i] = document.querySelector("#repeatOn" + i).checked == true ? 1 : 0;
    }

    chrome.runtime.sendMessage({ type: "addReminder", alarm: alarm});
}

//Shows and hides the repeat panel
function repeatSwitch(e) {
    var i;
    //If radio has just been clicked on
    if (e.currentTarget.checked == true) {
        document.querySelector("#repeatDays").style.display = "inline";
        //tick all the days
        for (i = 0; i < 7; i++) {
            document.querySelector("#repeatOn" + i).checked = true;
        }
    } else {
        document.querySelector("#repeatDays").style.display = "none";
        //untick all the days
        for (i = 0; i < 7; i++) {
            document.querySelector("#repeatOn" + i).checked = false;
        }
    }
}

//Converts an int into hex
function decToHex(dec) {
    var str = parseInt(dec, 10).toString(16);
    str = str.length == 0 ? "00" :
        str.length == 1 ? "0" + str :
            str.length == 2 ? str :
                str.substring(str.length - 2, str.length);
    return str;
}

//Sets the colour picker for the badge background colour to the current badge background colour
function setBadgePickerColour() {
    chrome.storage.sync.get("badgeColour", function (items) {
        var bRGB = items.badgeColour.split(",");
        document.querySelector("#badgePicker").value = "#" + decToHex(bRGB[0]) + decToHex(bRGB[1]) + decToHex(bRGB[2]);
    });
}

//Sets the colour picker for the badge background colour to the current badge background colour
function setDigitalForePickerColour() {
    chrome.storage.sync.get("digitalForeColour", function (items) {
        var bRGB = items.digitalForeColour.split(",");
        document.querySelector("#digitalPicker").value = "#" + decToHex(bRGB[0]) + decToHex(bRGB[1]) + decToHex(bRGB[2]);
    });
}

//When the custom date picker radio is clicked, show the date picker
function setDatePickerCustom(e) {
    document.querySelector("#newAlarmDatePickerControl").style.display = "inline";
}

//Sets the custom date picker to today
function setDatePickerToday(e) {
    chrome.storage.sync.get("offset", function (settings) {
        var d = new Date(Date.now() + (settings.offset * 1000 * 60 * 60));
        document.dp.setDate(d);
        document.querySelector("#newAlarmDatePickerControl").style.display = "none";
    });
}

//Sets the custom date picker to tomorrow
function setDatePickerTomorrow(e) {
    chrome.storage.sync.get("offset", function (settings) {
        var d = new Date(Date.now() + (settings.offset * 1000 * 60 * 60));
        d.setDate(d.getDate() + 1);
        document.dp.setDate(d);
        document.querySelector("#newAlarmDatePickerControl").style.display = "none";
    });
}

//Sets the value of the hands color colour and transparency controls to the currently selected values
function setHandsPickerColour() {
    chrome.storage.sync.get("handsColour", function (items) {
        var hRGB = items.handsColour.substr(5, items.handsColour.length - 1).split(",");
        document.querySelector("#handsPicker").value = "#" + decToHex(hRGB[0]) + decToHex(hRGB[1]) + decToHex(hRGB[2]);
        hRGB = items.handsColour.split(",");
        document.querySelector("#handsA").value = 100 * hRGB[3].substr(0, hRGB[3].length - 1);
    });
}

//Shows the hands colour and transparency controls and fires the function to set them to the correct value
function showCustomPanel(e) {
    document.querySelector("#handsPickerDiv").style.display = "inline";
    setHandsPickerColour();
}

//Handler for clicking the show digital checkbox
//Saves the value and updates the clock
//Shows or hides the colour picker control
function showDigitalChange(e) {
    chrome.storage.sync.set({ "showDigital": e.currentTarget.checked });
    if (e.currentTarget.checked) {
        document.querySelector("#badgePickerDiv").style.display = "inline";
    } else {
        document.querySelector("#badgePickerDiv").style.display = "none";
    }
    showHideDigitalForeTextPickerControls();
}

//Function to change the currently visible settings page
function switchPane(e) {
    //If the help link was clicked, go to the webhelp page
    if (e.currentTarget.id == "contacth") {
        window.open("https://ab00a.github.io/clockforgooglechrome/");
    } else {
        //First, hide the visible one
        document.querySelector(".optionOn").className = "optionOff";
        //Now show the selected one
        document.querySelector("#" + e.currentTarget.id.replace("h", "controls")).className = "optionOn";
        //Change the class of the previously selected link
        document.querySelector(".contentsItemOn").className = "contentsItem";
        //Change the class of the new link
        e.currentTarget.className = "contentsItemOn";
    }
}

//Once the DOM is available, add handlers and then fill the text - this is the main page set up function
document.addEventListener('DOMContentLoaded', function () {

    chrome.storage.onChanged.addListener(function (changes, area) {
        if (changes.alarms !== null) {
            showRemindersIn(document.querySelector("#listOfAlarms"), true);
        }
    });

    chrome.storage.sync.get(null, function (settings) {

        var bRGB, hRGB, dRGB, dt, lbls, i, el, daysNames, thisp, labelTypes;

        document.querySelector("#firstDayoftheWeek").selectedIndex = settings.firstDay;
        document.querySelector("#offset").value = settings.offset;
        bRGB = settings.badgeColour.split(",");
        dRGB = settings.digitalForeColour.split(",");
        setBadgePickerColour();
        document.querySelector("#badgeA").value = bRGB[3];
        document.querySelector("#digitalPickerA").value = dRGB[3];
        setHandsPickerColour();
        setDigitalForePickerColour();
        showHideDigitalForeTextPickerControls();

        switch (settings.hourChime) {
            case 0:
                document.querySelector("#hourChime").src = "../assets/nochimes.png";
                document.querySelector("#hourChime").setAttribute("data-value", "0");
                break;
            case 1:
                document.querySelector("#hourChime").src = "../assets/onechime.png";
                document.querySelector("#hourChime").setAttribute("data-value", "1");
                break;
            case 2:
                document.querySelector("#hourChime").src = "../assets/twochimes.png";
                document.querySelector("#hourChime").setAttribute("data-value", "2");
                break;
            case 4:
                document.querySelector("#hourChime").src = "../assets/fourchimes.png";
                document.querySelector("#hourChime").setAttribute("data-value", "4");
                break;
            default:
                document.querySelector("#hourChime").src = "../assets/nochimes.png";
                document.querySelector("#hourChime").setAttribute("data-value", "0");
                chrome.storage.sync.set({ "hourChime": 0 });
                break;
        }

        if (typeof settings.hourVolume == "undefined") {
            document.querySelector("#hourVolume").value = 1.0;
            chrome.storage.sync.set({ "hourVolume": 1.0 });
        } else {
            document.querySelector("#hourVolume").value = settings.hourVolume;
        }

        if (settings.showDigital === true) {
            document.querySelector("#showDigital").checked = true;
            document.querySelector("#badgePickerDiv").style.display = "inline";
        } else {
            document.querySelector("#showDigital").checked = false;
            document.querySelector("#badgePickerDiv").style.display = "none";
        }

        document.querySelector("#hoverTextCustomFormat").value = settings.hoverFormat;
        document.querySelector("#hoverTextCustom").value = settings.hoverFormat;

        document.querySelector("#hoverTextCustomFormat").style.display = "none";
        switch (settings.hoverFormat) {
            case "ta D d M Y":
                document.querySelector("#hoverTextLong12").checked = true;
                break;
            case "T D d M Y":
                document.querySelector("#hoverTextLong24").checked = true;
                break;
            case "T dsmsy":
                document.querySelector("#hoverTextShortUK").checked = true;
                break;
            case "T msdsy":
                document.querySelector("#hoverTextShortUS").checked = true;
                break;
            default:
                document.querySelector("#hoverTextCustom").checked = true;
                document.querySelector("#hoverTextCustomFormat").style.display = "inline";
                break;
        }

        switch (settings.handsColour) {
            case "rgba(0,0,0,0.4)":
                document.querySelector("#handColourDark").checked = true;
                document.querySelector("#handsPickerDiv").style.display = "none";
                break;
            case "rgba(200,200,200,0.2)":
                document.querySelector("#handColourPale").checked = true;
                document.querySelector("#handsPickerDiv").style.display = "none";
                break;
            default:
                document.querySelector("#handColourCustom").checked = true;
                document.querySelector("#handsPickerDiv").style.display = "inline";
                break;
        }
        switch (settings.dots) {
            case 12:
                document.querySelector("#rdoTwelveDots").checked = true;
                break;
            case 4:
                document.querySelector("#rdoFourDots").checked = true;
                break;
            default:
                document.querySelector("#rdoNoDots").checked = true;
                break;
        }

        if (settings.showAnalogue === true) {
            document.querySelector("#showAnalogue").checked = true;
            document.querySelector("#dotsSelection").style.display = "inline";
        } else {
            document.querySelector("#showAnalogue").checked = false;
            document.querySelector("#dotsSelection").style.display = "none";
        }

        //Add handlers to each element
        document.querySelector("#handColourPale").addEventListener("click", handsColourChange);
        document.querySelector("#handColourDark").addEventListener("click", handsColourChange);
        document.querySelector("#handColourCustom").addEventListener("click", showCustomPanel);
        document.querySelector("#showDigital").addEventListener("change", showDigitalChange);
        document.querySelector("#hoverTextLong12").addEventListener("click", dateFormatChange);
        document.querySelector("#hoverTextLong24").addEventListener("click", dateFormatChange);
        document.querySelector("#hoverTextShortUK").addEventListener("click", dateFormatChange);
        document.querySelector("#hoverTextShortUS").addEventListener("click", dateFormatChange);
        document.querySelector("#hoverTextCustom").addEventListener("click", dateFormatChange);
        document.querySelector("#hoverTextCustomFormat").addEventListener("keyup", customDateFormatChange);
        document.querySelector("#badgePicker").addEventListener("change", badgeColourChange);
        document.querySelector("#badgeA").addEventListener("mouseup", badgeColourChange);
        document.querySelector("#badgeA").addEventListener("keyup", badgeColourChange);
        document.querySelector("#digitalPicker").addEventListener("change", digitalColourChange);
        document.querySelector("#digitalPickerA").addEventListener("mouseup", digitalColourChange);
        document.querySelector("#digitalPickerA").addEventListener("keyup", digitalColourChange);
        document.querySelector("#handsPicker").addEventListener("change", handsColourCustomChange);
        document.querySelector("#handsPicker").addEventListener("click", setHandsPickerColour);
        document.querySelector("#handsA").addEventListener("mouseup", handsColourCustomChange);
        document.querySelector("#handsA").addEventListener("keyup", handsColourCustomChange);
        document.querySelector("#datePickerToday").addEventListener("click", setDatePickerToday);
        document.querySelector("#datePickerTomorrow").addEventListener("click", setDatePickerTomorrow);
        document.querySelector("#datePickerCustom").addEventListener("click", setDatePickerCustom);
        document.querySelector("#addNewAlarm").addEventListener("click", addNewAlarm);
        document.querySelector("#firstDayoftheWeek").addEventListener("change", changeFirstDay);
        document.querySelector("#appearanceh").addEventListener("click", switchPane);
        document.querySelector("#formath").addEventListener("click", switchPane);
        document.querySelector("#remindersh").addEventListener("click", switchPane);
        document.querySelector("#contacth").addEventListener("click", switchPane);
        document.querySelector("#repeatNewAlarm").addEventListener("change", repeatSwitch);
        document.querySelector("#rdoNoDots").addEventListener("click", dotsSwitch);
        document.querySelector("#rdoFourDots").addEventListener("click", dotsSwitch);
        document.querySelector("#rdoTwelveDots").addEventListener("click", dotsSwitch);
        document.querySelector("#showAnalogue").addEventListener("click", clockSwitch);
        document.querySelector("#offset").addEventListener("change", changeOffset);
        document.querySelector("#hourChime").addEventListener("click", changeHourChime);
        document.querySelector("#hourVolume").addEventListener("change", changeHourVolume);

        //Set up the date picker
        dt = new Date(Date.now() + (settings.offset * 1000 * 60 * 60));
        document.dp = new DatePick();
        document.dp.bForward = true;
        document.dp.setDate(dt);
        document.dp.setHandlerFunction(customDatePicked);
        document.dp.appendTo("newAlarmDatePickerControl");
        document.dp.show();
        document.querySelector("#newAlarmDatePickerControl").style.display = "none";

        //Set the time picker to the right time
        var strTime = "";
        if (dt.getHours().toString(10).length < 2) {
            strTime = "0";
        }
        strTime += dt.getHours().toString(10);
        strTime += ":";
        if (dt.getMinutes().toString(10).length < 2) {
            strTime += "0";
        }
        strTime += dt.getMinutes().toString(10);
        document.querySelector("#selectedTime").value = strTime;

        //Show reminders list in the right place
        showRemindersIn(document.querySelector("#listOfAlarms"), true);

        //Put i18n text in each element
        document.querySelector("#addNewAlarm").value = chrome.i18n.getMessage("lblAddNewAlarmHeading");

        chrome.runtime.sendMessage({type: "timeString", fmt: document.querySelector("#hoverTextLong12").value, d: dt}, function(response) {
            document.querySelector("#lblhoverTextLong12").innerHTML = response;
        });
        chrome.runtime.sendMessage({type: "timeString", fmt: document.querySelector("#hoverTextLong24").value, d: dt}, function(response) {
            document.querySelector("#lblhoverTextLong24").innerHTML = response;
        });
        chrome.runtime.sendMessage({type: "timeString", fmt: document.querySelector("#hoverTextShortUK").value, d: dt}, function(response) {
            document.querySelector("#lblhoverTextShortUK").innerHTML = response;
        });
        chrome.runtime.sendMessage({type: "timeString", fmt: document.querySelector("#hoverTextShortUS").value, d: dt}, function(response) {
            document.querySelector("#lblhoverTextShortUS").innerHTML = response;
        });

        //annoyingly, need to do <option> elements in a different way to the rest
        document.querySelector("#silence").text = chrome.i18n.getMessage("silence");

        var d = new Date("21 Feb 2021"); // SUNDAY
        daysNames = [];
        for (i= 0; i < 7; i++) {
            daysNames[i] = d.toLocaleString("default", {weekday: "long"});
            document.querySelector("#day" + i).text = daysNames[i];
            d.setDate(d.getDate() + 1);
        }

        //Do all of the label elements
        labelTypes = ".h2label, .h1label, .label, .contentsItem, .contentsItemOn";
        lbls = document.querySelectorAll(labelTypes).length;
        for (i = 0; i < lbls; i++) {
            document.querySelectorAll(labelTypes)[i].appendChild(document.createTextNode(chrome.i18n.getMessage(document.querySelectorAll(labelTypes)[i].id)));
        }
        document.querySelector("#lblHourChime").innerText = chrome.i18n.getMessage("hourChime");
        document.querySelector("#lblDigitalPicker").innerText = chrome.i18n.getMessage("digitalTitle");

        //Do all of the inputLabel elements
        lbls = document.querySelectorAll(".inputLabel").length;
        for (i = 0; i < lbls; i++) {
            document.querySelectorAll(".inputLabel")[i].innerHTML = chrome.i18n.getMessage(document.querySelectorAll(".inputLabel")[i].getAttribute("for"));
        }

        //Add 7 checkboxes in the right order within the repeatdays span
        document.querySelector("#repeatDays").style.display = "none";
        for (i = 0; i < 7; i++) {
            thisp = document.createElement("p");
            //add a checkbox
            el = document.createElement("input");
            el.type = "checkbox";
            el.id = "repeatOn" + ((parseInt(settings.firstDay, 10) + i) % 7);
            thisp.appendChild(el);

            //Add a label
            el = document.createElement("label");
            el.innerHTML = daysNames[(parseInt(settings.firstDay, 10) + i) % 7];
            el.htmlFor = "repeatOn" + ((parseInt(settings.firstDay, 10) + i) % 7);
            thisp.appendChild(el);

            document.querySelector("#repeatDays").appendChild(thisp);
        }

        document.title = chrome.i18n.getMessage("optionsTitle");
    });
});