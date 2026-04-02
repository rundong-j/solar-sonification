import m from "mithril";
import * as SunCalc from "suncalc";

// Helper to convert degrees to radians
function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

// Function to calculate solar panel output based on sun position and device orientation
function calculateSolarPanelOutput(sunAltitude_deg, sunAzimuth_deg_north, alpha_deg, beta_deg) {
    // Ensure all necessary data is available
    if (sunAltitude_deg === null || sunAzimuth_deg_north === null || alpha_deg === null || beta_deg === null) {
        return null; // Not enough data to calculate
    }

    // Convert all relevant angles to radians
    const sunAltitude_rad = toRadians(sunAltitude_deg);
    const sunAzimuth_rad = toRadians(sunAzimuth_deg_north);
    const alpha_rad = toRadians(alpha_deg);
    const beta_rad = toRadians(beta_deg);

    // 1. Sun Vector (unit vector in world coordinates: X=East, Y=North, Z=Up)
    // sunAzimuth_rad is North=0, East=PI/2, South=PI, West=3PI/2
    const sunVector_x = Math.cos(sunAltitude_rad) * Math.sin(sunAzimuth_rad);
    const sunVector_y = Math.cos(sunAltitude_rad) * Math.cos(sunAzimuth_rad);
    const sunVector_z = Math.sin(sunAltitude_rad);
    const sunVector = [sunVector_x, sunVector_y, sunVector_z];

    // 2. Panel Normal Vector (simplified model - assumes panel on the back of the device)
    // The panel's azimuth is directly from alpha (device heading)
    // The panel's altitude (angle from horizontal, or elevation) is derived from beta (pitch)
    // If beta = 0 (flat), panel faces straight up (altitude 90).
    // If beta = 90 (upright), panel faces horizontally (altitude 0).
    // This assumes beta is in [-90, 90] range. Math.abs is used to handle negative beta values consistently.
    const panelAltitude_deg = 90 - Math.abs(beta_deg);
    const panelAltitude_rad = toRadians(panelAltitude_deg);
    const panelAzimuth_rad = alpha_rad; // alpha is already North=0, East=90

    const panelNormal_x = Math.cos(panelAltitude_rad) * Math.sin(panelAzimuth_rad);
    const panelNormal_y = Math.cos(panelAltitude_rad) * Math.cos(panelAzimuth_rad);
    const panelNormal_z = Math.sin(panelAltitude_rad);
    const panelNormalVector = [panelNormal_x, panelNormal_y, panelNormal_z];

    // 3. Calculate the dot product (cosine of the angle of incidence)
    // For unit vectors, dot product directly gives the cosine of the angle between them.
    let dotProduct = 0;
    for (let i = 0; i < 3; i++) {
        dotProduct += sunVector[i] * panelNormalVector[i];
    }
    dotProduct = -dotProduct; // Invert dot product to represent panel on the back of the device

    // Solar panel output is proportional to the cosine of the angle of incidence.
    // It should be 0 if the sun is behind the panel (dot product < 0).
    const solarPanelOutput = Math.max(0, dotProduct); // Value between 0 and 1

    return { output: solarPanelOutput.toFixed(2), dotProduct: dotProduct.toFixed(2) }; // Return both
}

// Main application logic
// Adding a comment to trigger a new GitHub Pages deploy
const App = {
    oninit: function(vnode) {
        vnode.state.latitude = null;
        vnode.state.longitude = null;
        vnode.state.geolocationError = null;
        vnode.state.alpha = null; // Z-axis rotation (0-360, compass direction)
        vnode.state.beta = null;  // X-axis rotation (-180-180, front-back tilt)
        vnode.state.gamma = null; // Y-axis rotation (-90-90, left-right tilt)
        vnode.state.orientationError = null;
        vnode.state.orientationPermissionGranted = false;
        vnode.state.sunAltitude = null;
        vnode.state.sunAzimuth = null;
        vnode.state.solarPanelOutput = null; // New state for solar panel output
        vnode.state.sunUpdateInterval = null; // To store the interval ID

        // Sonification state and setup
        vnode.state.audioContext = null;
        vnode.state.oscillator = null;
        vnode.state.gainNode = null;
        vnode.state.isSonificationPlaying = false;
        vnode.state.currentGain = 0; // New state to display current gain
        vnode.state.currentPitch = 0; // New state to display current pitch
        vnode.state.dotProduct = null; // New state for dot product

        // Function to start/stop sonification
        const toggleSonification = () => {
            if (vnode.state.isSonificationPlaying) {
                // Stop sonification
                if (vnode.state.oscillator) {
                    vnode.state.oscillator.stop();
                    vnode.state.oscillator.disconnect();
                    vnode.state.oscillator = null;
                }
                if (vnode.state.audioContext) {
                    vnode.state.audioContext.close();
                    vnode.state.audioContext = null;
                }
                vnode.state.isSonificationPlaying = false;
            } else {
                // Start sonification
                vnode.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                vnode.state.oscillator = vnode.state.audioContext.createOscillator();
                vnode.state.gainNode = vnode.state.audioContext.createGain();

                vnode.state.oscillator.type = 'sine'; // or 'square', 'sawtooth', 'triangle'
                vnode.state.oscillator.frequency.setValueAtTime(440, vnode.state.audioContext.currentTime); // Initial A4 note
                vnode.state.gainNode.gain.setValueAtTime(0.5, vnode.state.audioContext.currentTime); // Set initial gain to make it audible

                vnode.state.oscillator.connect(vnode.state.gainNode);
                vnode.state.gainNode.connect(vnode.state.audioContext.destination);

                vnode.state.oscillator.start();
                vnode.state.isSonificationPlaying = true;
            }

        };

        // Expose to component for UI interaction
        vnode.state.toggleSonification = toggleSonification;

        // Function to update sun position and solar panel output
        const updateCalculations = () => {
            if (vnode.state.latitude !== null && vnode.state.longitude !== null) {
                // Update Sun Position
                const now = new Date();
                const sunPos = SunCalc.getPosition(now, vnode.state.latitude, vnode.state.longitude);
                vnode.state.sunAltitude = (sunPos.altitude * 180 / Math.PI).toFixed(2); // Convert to degrees
                // SunCalc's azimuth is from South, clockwise. Convert to North=0, East=90, South=180, West=270
                let azimuth_deg = sunPos.azimuth * 180 / Math.PI; // Convert to degrees
                azimuth_deg = (azimuth_deg + 180) % 360; // Adjust to North=0 and wrap around
                vnode.state.sunAzimuth = azimuth_deg.toFixed(2);

                // Update Solar Panel Output
                if (vnode.state.alpha !== null && vnode.state.beta !== null && vnode.state.gamma !== null) {
                    const panelOutput = calculateSolarPanelOutput(
                        parseFloat(vnode.state.sunAltitude),
                        parseFloat(vnode.state.sunAzimuth),
                        parseFloat(vnode.state.alpha),
                        parseFloat(vnode.state.beta)
                    );
                    vnode.state.solarPanelOutput = panelOutput.output;
                    vnode.state.dotProduct = panelOutput.dotProduct;

                    // Update sonification pitch
                    if (vnode.state.isSonificationPlaying && vnode.state.oscillator) {
                        const minFrequency = 200; // Hz
                        const maxFrequency = 800; // Hz
                        const pitchValue = minFrequency + (maxFrequency - minFrequency) * parseFloat(vnode.state.solarPanelOutput);
                        vnode.state.oscillator.frequency.setValueAtTime(pitchValue, vnode.state.audioContext.currentTime);
                        vnode.state.currentPitch = pitchValue.toFixed(0); // Store for display
                    }
                }

            }
        };

        // Geolocation setup
        if ("geolocation" in navigator) {
            navigator.geolocation.watchPosition(
                function(position) {
                    vnode.state.latitude = position.coords.latitude;
                    vnode.state.longitude = position.coords.longitude;
                    updateCalculations(); // Update all calculations immediately on geolocation update
                    // If an interval is already running, clear it before setting a new one
                    if (vnode.state.sunUpdateInterval) {
                        clearInterval(vnode.state.sunUpdateInterval);
                    }
                    // Start updating calculations every second
                    vnode.state.sunUpdateInterval = setInterval(() => { updateCalculations(); m.redraw(); }, 1000);
                    m.redraw();
                },
                function(error) {
                    vnode.state.geolocationError = error.message;
                    m.redraw();
                }
            );
        } else {
            vnode.state.geolocationError = "Geolocation is not supported by this browser.";
        }

        // Device Orientation setup
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            vnode.state.orientationPermissionGranted = false;
        } else if (window.DeviceOrientationEvent) {
            vnode.state.orientationPermissionGranted = true;
            window.addEventListener('deviceorientation', function(event) {
                vnode.state.alpha = event.alpha ? event.alpha.toFixed(2) : null;
                vnode.state.beta = event.beta ? event.beta.toFixed(2) : null;
                vnode.state.gamma = event.gamma ? event.gamma.toFixed(2) : null;
                updateCalculations(); // Update calculations on orientation change
                m.redraw();
            }, true);
        } else {
            vnode.state.orientationError = "Device Orientation is not supported by this browser.";
        }
    },

    onremove: function(vnode) {
        // Clear the interval when the component is removed to prevent memory leaks
        if (vnode.state.sunUpdateInterval) {
            clearInterval(vnode.state.sunUpdateInterval);
        }
        // Stop and close audio context if it exists
        if (vnode.state.audioContext) {
            vnode.state.audioContext.close();
            vnode.state.audioContext = null;
        }
    },

    requestOrientationPermission: function(vnode) {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        vnode.state.orientationPermissionGranted = true;
                        window.addEventListener('deviceorientation', function(event) {
                            vnode.state.alpha = event.alpha ? event.alpha.toFixed(2) : null;
                            vnode.state.beta = event.beta ? event.beta.toFixed(2) : null;
                            vnode.state.gamma = event.gamma ? event.gamma.toFixed(2) : null;
                            updateCalculations(); // Update calculations on orientation change
                            m.redraw();
                        }, true);
                    } else {
                        vnode.state.orientationError = "Permission to access device orientation was denied.";
                    }
                    m.redraw();
                })
                .catch(error => {
                    vnode.state.orientationError = "Error requesting device orientation permission: " + error.message;
                    m.redraw();
                });
        }
    },

    view: function(vnode) {
        return m("div", [
            m("h1", "Solar Sonification"),
            vnode.state.geolocationError ?
                m("p", "Geolocation Error: " + vnode.state.geolocationError) :
                m("div", [
                    m("p", "Latitude: " + (vnode.state.latitude || "Waiting...")),
                    m("p", "Longitude: " + (vnode.state.longitude || "Waiting...")),
                    m("p", "Sun Altitude: " + (vnode.state.sunAltitude || "Waiting...") + "°"),
                    m("p", "Sun Azimuth: " + (vnode.state.sunAzimuth || "Waiting...") + "°"),
                    m("p", "Solar Panel Output: " + (vnode.state.solarPanelOutput !== null ? (vnode.state.solarPanelOutput * 100).toFixed(0) + "%" : "Waiting...")),
                    vnode.state.isSonificationPlaying ? m("p", "Current Pitch: " + vnode.state.currentPitch + " Hz") : null,
                    m("button", {
                        onclick: vnode.state.toggleSonification
                    }, vnode.state.isSonificationPlaying ? "Stop Sonification" : "Start Sonification")
                ]),
            m("hr"), // Separator

            m("div", [
                m("h2", "Debug Info"),
                m("p", "Dot Product (Sun vs Panel): " + (vnode.state.dotProduct !== null ? vnode.state.dotProduct : "Waiting...")),
            ]),

            m("hr"), // Separator
            vnode.state.orientationError ?
                m("p", "Orientation Error: " + vnode.state.orientationError) :
                m("div", [
                    !vnode.state.orientationPermissionGranted ?
                        m("button", { onclick: () => App.requestOrientationPermission(vnode) }, "Allow Device Orientation") :
                        m("div", [
                            m("p", "Alpha (Z-axis): " + (vnode.state.alpha || "Waiting...")),
                            m("p", "Beta (X-axis): " + (vnode.state.beta || "Waiting...")),
                            m("p", "Gamma (Y-axis): " + (vnode.state.gamma || "Waiting..."))
                        ])
                ])
        ]);
    }
};

m.mount(document.body, App);
