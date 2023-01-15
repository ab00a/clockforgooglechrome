chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.type == "soundAudio") {
        sendResponse({ msg, reply: "Request for sound received" });
        if (msg.audioSrc) {
            var audio = new Audio("assets/" + msg.audioSrc);
            document.body.appendChild(audio);
            audio.id = msg.id;
            audio.name = "alarm";
            audio.loop = true; // Alarms just keep going
            if (msg.volume) {
                audio.volume = msg.volume;
            }
            audio.play();
            audio.onpause = function () { // Removes this audio element when playing is paused
                audio.remove();
                audio = null;
            };
        }
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
            if (audio.ended) { // Removes chime element after the audio has finished playing
                audio.remove();
                audio = null;
            };
        };
    }

    if (msg.type == "stopAudio") {
        sendResponse({ msg, reply: "Request for stop received" });
        console.log(msg.id);
        var audio = document.getElementById(msg.id);
        if (audio != null) {
            audio.pause(); // Pauses selected alarm, thus condemning it to deletion
        }
    }

});