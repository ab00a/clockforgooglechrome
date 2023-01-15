chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type == "soundAudio") {
        sendResponse({ msg, reply: "Request for sound received" });
        var audio = new Audio("assets/" + msg.audioSrc); // Add register and error checking logic
        audio.id = msg.id;
        audio.loop = true; // Alarms just keep going
        if (msg.volume) {
            audio.volume = msg.volume;
        }
        audio.play();
        audio.onpause = function () {
            if (audio.ended) {
                audio.remove();
                audio = null;
            };
        };
    }

    if (msg.type == "chime") {
        sendResponse({ msg, reply: "Request for chime received" });
        var audio = new Audio("assets/diing.ogg"); // Add register and error checking logic
        audio.id = "chime";
        audio.loop = false; // Chime rings once
        if (msg.volume) {
            audio.volume = msg.volume;
        }
        audio.play();
        audio.onpause = function () {
            if (audio.ended) {
                audio.remove();
                audio = null;
            };
        };
    }

    if (msg.type == "stopAudio") {
        sendResponse({ msg, reply: "Request for stop received" });
        var audio = document.getElementById(msg.id);
        if (audio != null) {
            audio.pause();
        }
    }

});