"use strict"
//Handler for the delete icon
//removes it from the storage, housekeeps and updates the list
//but checks with the user first
function deleteAlarm(e) {
    var idd = e.currentTarget.id;
    if (confirm(chrome.i18n.getMessage("deleteCheck"))) {
        chrome.runtime.getBackgroundPage(function (bkg) {
            bkg.deleteReminder(idd);
        });
    }
}

//Handler for the edit icon
//removes it from the storage, housekeeps and updates the list
//but then, cleverly, populates the form with all of the details of this alarm
function editAlarm(e) {
    var id = e.currentTarget.id;
    chrome.storage.sync.get("alarms", function (items) {
        var alarmTime, i;
        //Set the label, sound, time, time, time repeat, date and date
        //Populate the label
        document.querySelector("#newAlarmLabel").value = items.alarms[id][2];
        alarmTime = new Date(items.alarms[id][0]);
        //Populate the time
        document.querySelector("#selectedTime").valueAsDate = new Date(alarmTime.getTime() - (alarmTime.getTimezoneOffset() * 60000));
        //Populate the date
        document.querySelector("#datePickerCustom").checked = true;
        document.dp.setDate(alarmTime);
        document.querySelector("#newAlarmDatePickerControl").style.display = "inline";

        //If it's a repeater, tick the boxes
        if (items.alarms[id][3].indexOf(1) > -1) {
            document.querySelector("#repeatNewAlarm").checked = true;
            document.querySelector("#repeatDays").style.display = "inline";
            for (i = 0; i < 7; i++) {
                document.querySelector("#repeatOn" + i).checked = ((items.alarms[id][3][i] == 1) ? true : false);
            }
        } else {
            document.querySelector("#repeatDays").style.display = "none";
            //untick all the days
            for (i = 0; i < 7; i++) {
                document.querySelector("#repeatOn" + i).checked = false;
            }
            document.querySelector("#repeatNewAlarm").checked = false;
        }

        //...and the sound
        if (items.alarms[id][4] != "undefined") {
            document.querySelector("#reminderVolume").value = parseFloat(items.alarms[id][4]);
        }
        switch (items.alarms[id][1]) {
            case "diing":
                document.querySelector("#newAlarmRing").selectedIndex = 1;
                break;
            case "hiphop":
                document.querySelector("#newAlarmRing").selectedIndex = 2;
                break;
            case "noknoknok":
                document.querySelector("#newAlarmRing").selectedIndex = 3;
                break;
            case "tingaling":
                document.querySelector("#newAlarmRing").selectedIndex = 4;
                break;
            case "waawwaaw":
                document.querySelector("#newAlarmRing").selectedIndex = 5;
                break;
            default:
                document.querySelector("#newAlarmRing").selectedIndex = 0;
                break;
        }

        //Now remove it from the database
        chrome.runtime.getBackgroundPage(function (bkg) {
            bkg.deleteReminder(id);
        });
    });
}

function redButton(e) {
    e.currentTarget.src = "../assets/delete_over.png";
}

function greyButton(e) {
    e.currentTarget.src = "../assets/delete.png";
}

/*Creates a nicely arranged view of all current reminders
and places them in targetElement as a table.
targetElement - HTML element - to put the table in
editable - boolean - determines whether delete and edit controls are included
*/
function showRemindersIn(targetElement, editable) {
    chrome.storage.sync.get(["firstDay", "alarms", "hoverFormat"], function (items) {
        chrome.runtime.getBackgroundPage(function (bkg) {
            var noAlarms, i, j, remindersTable, thisAlarm, when, alarmDelete, descriptor, label, whenlabel,
                mintext, repeaticon, deletes, soundIcon, alarmEdit, category, row, colZero, colOne, colTwo,
                colThree, colFour, repeatsNumber, daysNames, a_rowSorter;
            targetElement.innerHTML = "";
            if (items.alarms.length < 1) {
                if (editable) {
                    noAlarms = document.createTextNode(chrome.i18n.getMessage("noReminders"));
                    targetElement.appendChild(noAlarms);
                }
            } else {
                remindersTable = document.createElement("table");
                remindersTable.id = "remindersTable";
                items.alarms.forEach(function (alarm, i, alarms) {
                    row = document.createElement("tr");
                    colZero = document.createElement("td");
                    colOne = document.createElement("td");
                    colTwo = document.createElement("td");
                    colThree = document.createElement("td");
                    colFour = document.createElement("td");
                    row.appendChild(colZero);
                    row.appendChild(colOne);
                    row.appendChild(colTwo);
                    row.appendChild(colThree);
                    row.appendChild(colFour);

                    when = new Date(alarm[0]);
                    row.id = when.getTime();

                    if (editable) {
                        alarmDelete = document.createElement("img");
                        alarmDelete.src = "../assets/delete.png";
                        alarmDelete.id = i;
                        alarmDelete.alt = chrome.i18n.getMessage("delete");
                        alarmDelete.title = chrome.i18n.getMessage("delete");
                        alarmDelete.className = "deleteIcon";
                        alarmDelete.addEventListener("click", deleteAlarm);
                        alarmDelete.addEventListener("mouseover", redButton);
                        alarmDelete.addEventListener("mouseout", greyButton);

                        alarmEdit = document.createElement("img");
                        alarmEdit.src = "../assets/edit.png";
                        alarmEdit.id = i;
                        alarmEdit.alt = chrome.i18n.getMessage("edit");
                        alarmEdit.title = chrome.i18n.getMessage("edit");
                        alarmEdit.className = "deleteIcon";
                        alarmEdit.addEventListener("click", editAlarm);
                    }

                    descriptor = document.createElement("b");
                    label = document.createTextNode(alarm[2] + " ");
                    descriptor.appendChild(label);

                    //Now the label to describe when the alarm sounds
                    whenlabel = when.getHours() + ":";
                    mintext = when.getMinutes();
                    if (mintext < 10) {
                        mintext = "0" + mintext;
                    }
                    whenlabel += mintext;
                    daysNames = [
                        chrome.i18n.getMessage("Sunday"),
                        chrome.i18n.getMessage("Monday"),
                        chrome.i18n.getMessage("Tuesday"),
                        chrome.i18n.getMessage("Wednesday"),
                        chrome.i18n.getMessage("Thursday"),
                        chrome.i18n.getMessage("Friday"),
                        chrome.i18n.getMessage("Saturday"),
                    ];
                    repeatsNumber = 0;
                    for (j = 0; j < 7; j++) {
                        repeatsNumber += alarm[3][j];
                    }
                    if (repeatsNumber > 4) {
                        whenlabel += chrome.i18n.getMessage("everyDay");
                        if (repeatsNumber < 7) {
                            whenlabel += " except";
                            for (j = parseInt(items.firstDay, 10); j < (parseInt(items.firstDay, 10) + 7); j++) {
                                if (alarm[3][j % 7] == 0) {
                                    whenlabel += " " + daysNames[j % 7] + ", ";
                                }
                            }
                        }
                    } else {
                        if (repeatsNumber == 0) {
                            whenlabel += chrome.i18n.getMessage("on");
                            whenlabel += bkg.timeString("d M Y", when) + " ";
                        } else {
                            whenlabel += chrome.i18n.getMessage("every");
                            for (j = parseInt(items.firstDay, 10); j < (parseInt(items.firstDay, 10) + 7); j++) {
                                if (alarm[3][j % 7] == 1) {
                                    whenlabel += " " + daysNames[j % 7] + ", ";
                                }
                            }
                        }
                    }
                    if (repeatsNumber > 0) {
                        repeaticon = document.createElement("img");
                        repeaticon.src = "../assets/repeat.png";
                        repeaticon.alt = repeaticon.title = chrome.i18n.getMessage("nextReminder") + bkg.timeString(items.hoverFormat, when);
                        colTwo.appendChild(repeaticon);
                    }
                    //label complete, now remove the trailing comma and replace any penultimate one with 'and'
                    //No Oxford commas for me!!
                    if (whenlabel.lastIndexOf(", ") == (whenlabel.length - 2)) {
                        whenlabel = whenlabel.substr(0, whenlabel.length - 2);
                    }
                    if (whenlabel.lastIndexOf(",") > -1) {
                        whenlabel = whenlabel.substr(0, whenlabel.lastIndexOf(","))
                            + chrome.i18n.getMessage("and")
                            + whenlabel.substr(whenlabel.lastIndexOf(",") + 1);
                    }
                    whenlabel = document.createTextNode(whenlabel);

                    soundIcon = document.createElement("img");
                    if (alarm[1] === "nothing") {
                        soundIcon.src = "../assets/silent.png";
                        soundIcon.alt = chrome.i18n.getMessage("silent");
                        soundIcon.title = chrome.i18n.getMessage("silent");
                    } else {
                        soundIcon.src = "../assets/ring.png";
                        soundIcon.alt = alarm[1];
                        soundIcon.title = alarm[1];
                    }

                    colZero.appendChild(soundIcon);
                    colOne.appendChild(descriptor);
                    colThree.appendChild(whenlabel);
                    if (editable) {
                        colFour.appendChild(alarmEdit);
                        colFour.appendChild(alarmDelete);
                    }
                    remindersTable.appendChild(row);
                });

                //Now sort the table so the alarms appear in chronological order
                a_rowSorter = new Array();
                for (i = 0; i < remindersTable.rows.length; i++) {
                    a_rowSorter[i] = remindersTable.rows[i];
                }
                a_rowSorter.sort(function (a, b) {
                    return (parseFloat(a.id) - parseFloat(b.id));
                });
                a_rowSorter.forEach(function (item, id, items) {
                    item.parentNode.appendChild(item);
                });

                targetElement.appendChild(remindersTable);

                deletes = document.getElementsByName("deleteAlarm").length;
                for (i = 0; i < deletes; i++) {
                    document.getElementsByName("deleteAlarm")[i].addEventListener("click", deleteAlarm);
                }
            }
        });
    });
}