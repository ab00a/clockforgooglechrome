"use strict";
function mouseOver(e) {
	e.currentTarget.className += "over";
}

function mouseOut(e) {
	e.currentTarget.className = e.currentTarget.className.replace("over", "");
}

function DatePick() {
	var tableHead, tableBody, i, headerCell, headerCells, imgNextYear, imgPrevYear,
		imgNextMonth, imgPrevMonth, self, n, len, j, cell;

	//creates the wireframe table with day headers, no other content
	this.calendarContainer = document.createElement("table");
	this.calendarContainer.id = "calutilCalendar";
	this.selectedDate = new Date();
	this.displayedDate = new Date();
	this.bForward = false;
	this.handlerFunction = false;

	tableHead = document.createElement("thead");
	tableHead.className = "calHead";
	this.calendarContainer.appendChild(tableHead); //creates the table head

	tableBody = document.createElement("tbody");
	tableBody.className = "calBody";
	this.calendarContainer.appendChild(tableBody); //creates the table body

	this.calendarContainer.querySelector("thead").appendChild(document.createElement("tr")); //creates one row in the head

	for (i = 0; i < 7; i++) {
		this.calendarContainer.querySelector("tbody").appendChild(document.createElement("tr")); //creates 7 rows in the body
	}

	for (i = 0; i < 5; i++) {
		headerCell = document.createElement("th");
		headerCell.className = "headCell";
		this.calendarContainer.querySelector("thead>tr").appendChild(headerCell); //creates 5 header cells in the head
	}

	headerCells = this.calendarContainer.querySelectorAll("thead>tr>th");

	imgNextYear = document.createElement("img");
	imgNextMonth = document.createElement("img");
	imgPrevYear = document.createElement("img");
	imgPrevMonth = document.createElement("img");
	imgNextYear.src = "../assets/yrfwd.png";
	imgNextMonth.src = "../assets/forward.png";
	imgPrevYear.src = "../assets/yrbak.png";
	imgPrevMonth.src = "../assets/back.png";

	self = this;

	this.mouseClick = function (e) {
		//Don't do anything if an unselectable date has been clicked
		if (e.currentTarget.className.indexOf("unselectable") == -1) {
			var selectedCell = self.calendarContainer.querySelector("#calutilcalendar>tbody>tr>.selectableotherselected, #calutilcalendar>tbody>tr>.selectablepresentselected");
			if (selectedCell) {
				selectedCell.className = selectedCell.className.replace("selected", "");
			}
			e.currentTarget.className = e.currentTarget.className.replace("over", "") + "selected";
			self.selectedDate.setTime(e.currentTarget.value);
			if (self.handlerFunction) {
				self.handlerFunction(self.selectedDate);
			}
		}
	};

	headerCells[0].id = "backOneYear";
	headerCells[0].appendChild(imgPrevYear);
	headerCells[0].addEventListener("click", function () {
		self.displayedDate.setFullYear(self.displayedDate.getFullYear() - 1);
		self.updateDisplay(self.displayedDate);
	});

	headerCells[1].id = "backOneMonth";
	headerCells[1].appendChild(imgPrevMonth);
	headerCells[1].addEventListener("click", function () {
		self.displayedDate.setMonth(self.displayedDate.getMonth() - 1);
		self.updateDisplay(self.displayedDate);
	});

	headerCells[2].id = "monthYearHeading";
	headerCells[2].colSpan = 3; //The cell for the Month Year heading

	headerCells[3].id = "fwdOneMonth";
	headerCells[3].appendChild(imgNextMonth);
	headerCells[3].addEventListener("click", function () {
		self.displayedDate.setMonth(self.displayedDate.getMonth() + 1);
		self.updateDisplay(self.displayedDate);
	});

	headerCells[4].id = "fwdOneyear";
	headerCells[4].appendChild(imgNextYear);
	headerCells[4].addEventListener("click", function () {
		self.displayedDate.setFullYear(self.displayedDate.getFullYear() + 1);
		self.updateDisplay(self.displayedDate);
	});

	n = -7; //counter for the table cells
	len = this.calendarContainer.querySelectorAll("tbody>tr").length;
	for (i = 0; i < len; i++) {
		for (j = 0; j < 7; j++) {
			cell = document.createElement("td"); //a new cell
			cell.id = "cell" + (n++);    //with a new id
			cell.className = "selectablePresent"; //Could be unselectablePresent, selectableOther, unselectableOther or selectedDay
			this.calendarContainer.querySelectorAll("tbody>tr")[i].appendChild(cell); //creates 8 cells in each body row and names them
		}
	}

	for (i = -7; i < 0; i++) {
		this.calendarContainer.querySelector("#cell" + i).className = "dayHead"; //changes the class of the day headers
	}

	for (i = 0; i < 42; i++) {
		this.calendarContainer.querySelector("#cell" + i).addEventListener("mouseover", mouseOver);
		this.calendarContainer.querySelector("#cell" + i).addEventListener("mouseout", mouseOut);
		this.calendarContainer.querySelector("#cell" + i).addEventListener("click", this.mouseClick);
	}

	for (i = -7; i < 0; i++) {
		this.calendarContainer.querySelector("#cell" + i).appendChild(document.createTextNode("day"));
	}

	this.hide(); //don't show it until it is called
}

DatePick.prototype.show = function show() {
	this.calendarContainer.style.display = "block";
};

DatePick.prototype.hide = function hide() {
	this.calendarContainer.style.display = "none";
};

DatePick.prototype.setDate = function setDate(d) {
	//populates the table according to the date d
	this.selectedDate = d;
	this.updateDisplay(d);
};

DatePick.prototype.updateDisplay = function updateDisplay(d) {
	var self = this;
	chrome.storage.sync.get("firstDay", function (items) {
		chrome.runtime.getBackgroundPage(function (bkg) {
			var i, workingDate, currentMonth, dayCell, className, daysOfTheWeek, n, rollBack, reminderMarker, reminders;

			//Puts the first n letters of the day (for your locale) in the heading cells
			//special overrides for Russian and Chinese added in 2.3.0.0
			daysOfTheWeek = [];

			if (chrome.i18n.getUILanguage().indexOf("ru") > -1) {
				daysOfTheWeek = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
			} else if (chrome.i18n.getUILanguage().indexOf("zh") > -1) {
				daysOfTheWeek = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
			} else {
				daysOfTheWeek = [
					chrome.i18n.getMessage("Sunday"),
					chrome.i18n.getMessage("Monday"),
					chrome.i18n.getMessage("Tuesday"),
					chrome.i18n.getMessage("Wednesday"),
					chrome.i18n.getMessage("Thursday"),
					chrome.i18n.getMessage("Friday"),
					chrome.i18n.getMessage("Saturday")
				];
			}

			n = 2;
			for (i = -7; i < 0; i++) {
				self.calendarContainer.querySelector("#cell" + i).innerText = daysOfTheWeek[(parseInt(items.firstDay, 10) + i + 7) % 7].substr(0, n);
			}

			//Put the month and the year of d in the heading cell id monthYearHeading*/
			self.calendarContainer.querySelectorAll("thead>tr>th")[2].innerHTML = bkg.timeString("M Y", d);

			//Get the date for the first cell
			self.displayedDate.setTime(d.getTime());
			self.displayedDate.setDate(1); //now displayDate is the first of the month, so getDay tells us the column to put "1" in
			rollBack = self.displayedDate.getDay() - parseInt(items.firstDay, 10);
			if (rollBack < 0) {
				rollBack += 7;
			}
			workingDate = new Date();
			workingDate.setTime(self.displayedDate.getTime() - (rollBack * 1000 * 3600 * 24)); //now we're at position 0,0 after taking into account what the first column is
			workingDate.setHours(0);
			workingDate.setMinutes(0);
			workingDate.setSeconds(0);
			workingDate.setMilliseconds(0);

			currentMonth = false;
			for (i = 0; i < 42; i++) {
				dayCell = self.calendarContainer.querySelector("#cell" + i);
				dayCell.value = workingDate.getTime();
				dayCell.innerHTML = workingDate.getDate();

				//Now build the classname for formatting
				className = "selectable";
				//if that node is 1, boolean switch between present class and other class (open with othermonth)

				if ((workingDate.getTime() < (Date.now() - (24 * 60 * 60 * 1000))) && self.bForward) {
					className = "unselectable";
				}
				if (workingDate.getDate() === 1) {
					currentMonth = !currentMonth;
				}
				if (currentMonth) {
					className += "present";
				} else {
					className += "other";
				}
				if (workingDate.toDateString() === self.selectedDate.toDateString()) {
					className += "selected";
				}
				dayCell.className = className;

				//increment ready for next loop
				workingDate.setDate(workingDate.getDate() + 1);
			}
		});
	});
};

DatePick.prototype.appendTo = function appendTo(el) {
	document.querySelector("#" + el).appendChild(this.calendarContainer);
	this.show();
};

DatePick.prototype.setHandlerFunction = function setHandlerFunction(f) {
	this.handlerFunction = f;
};

DatePick.prototype.nextMonth = function nextMonth(e) {
	this.displayedDate.setMonth(this.displayedDate.getMonth() - 1);
	this.updateDisplay(this.displayedDate);
};