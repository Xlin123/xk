import React, { useEffect, useState } from 'react';
import axios from 'axios';

const App: React.FC = () => {
    const client_id = import.meta.env.VITE_CLIENT_ID;
    const redirect_uri = import.meta.env.REDIRECT_URI;
    const [authenticated, setAuthenticated] = useState(false);
    const [events, setEvents] = useState<any[]>([]);
    const [hoursToReserve, setHoursToReserve] = useState(1);

    const handleAuthorize = async () => {
        try {
            oauth2SignIn();
        } catch (error) {
            console.error("Authorization error:", error);
        }
    };

    var fragmentString = location.hash.substring(1);
    var params = {};
    var regex = /([^&=]+)=([^&]*)/g, m;
    while (m = regex.exec(fragmentString)) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }
    if (Object.keys(params).length > 0 && params['state']) {
        if (params['state'] == localStorage.getItem('state')) {
            localStorage.setItem('oauth2-params', JSON.stringify(params));
            window.history.pushState({}, document.title, "/");
            setAuthenticated(true);
            console.error("Successfully authenticated");
        } else {
            console.log('State mismatch. Possible CSRF attack');
        }
    }

    useEffect(() => {
        const fetchData = async () => {
            await loadCalendar();
            loadComponent();
        };
        fetchData();
    }, [authenticated]);

    function generateCryptoRandomState() {
        const randomValues = new Uint32Array(2);
        window.crypto.getRandomValues(randomValues);

        // Encode as UTF-8
        const utf8Encoder = new TextEncoder();
        const utf8Array = utf8Encoder.encode(
            String.fromCharCode.apply(null, randomValues)
        );

        // Base64 encode the UTF-8 data
        return btoa(String.fromCharCode.apply(null, utf8Array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    function oauth2SignIn() {
        var state = generateCryptoRandomState();
        localStorage.setItem('state', state);
        // Google's OAuth 2.0 endpoint for requesting an access token
        var oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';

        // Create <form> element to submit parameters to OAuth 2.0 endpoint.
        var form = document.createElement('form');
        form.setAttribute('method', 'GET'); // Send as a GET request.
        form.setAttribute('action', oauth2Endpoint);

        // Parameters to pass to OAuth 2.0 endpoint.
        var params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'token',
            'scope': 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.freebusy',
            'include_granted_scopes': 'true',
            'state': state
        };

        // Add form parameters as hidden input values.
        for (var p in params) {
            var input = document.createElement('input');
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', p);
            input.setAttribute('value', params[p]);
            form.appendChild(input);
        }

        // Add form to page and submit it to open the OAuth 2.0 endpoint.
        document.body.appendChild(form);
        form.submit();
    }

    async function loadCalendar() {
        var params = JSON.parse(localStorage.getItem('oauth2-params')!);
        if (params && params['access_token']) {
            setAuthenticated(true);
            await fetchEvents();
        } else {
            oauth2SignIn();
        }
    }

    function loadComponent() {
        return !authenticated ? (
            <button onClick={handleAuthorize}>Authorize Google Account</button>
        ) : (
            <div>
                <div>
                    <label htmlFor="hours">Hours to Reserve:</label>
                    <input
                        type="number"
                        id="hours"
                        name="hours"
                        min="1"
                        max="24"
                        onChange={(e) => setHoursToReserve(Number(e.target.value))}
                    />
                </div>
                <button onClick={fetchEvents}>Find Free Date</button>
                <ul>
                    {events.map((event, index) => (
                        <li key={index}>{event.summary + " \n" + event.time + (event.recurrence ? ("\n Reoccurs " + event.recurrence) : "")}</li>
                    ))}
                </ul>
            </div>
        )
    }

    const findEarliestDate = (events: any[]) => {
        const daytimeStart = 8; // 8 AM
        const daytimeEnd = 20; // 8 PM

        // Convert hours to milliseconds
        const hoursToMilliseconds = (hours: number) => hours * 60 * 60 * 1000;

        // Check if a given time is within daytime hours
        const isWithinDaytime = (date: Date) => {
            const hours = date.getHours();
            return hours >= daytimeStart && hours < daytimeEnd;
        };

        // Find the earliest available slot
        const findSlot = () => {
            const now = new Date();
            const duration = hoursToMilliseconds(hoursToReserve);

            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                const eventStart = new Date(event.start);
                const eventEnd = new Date(event.end);

                // Check if the current time slot is within daytime hours
                if (isWithinDaytime(eventEnd)) {
                    const nextEventStart = i + 1 < events.length ? new Date(events[i + 1].start) : null;

                    // If there is no next event or the gap is sufficient
                    if (!nextEventStart || (nextEventStart.getTime() - eventEnd.getTime() >= duration)) {
                        const potentialStart = new Date(eventEnd.getTime());
                        const potentialEnd = new Date(eventEnd.getTime() + duration);

                        // Ensure the potential end time is within daytime hours
                        if (isWithinDaytime(potentialEnd)) {
                            return potentialStart;
                        }
                    }
                }
            }

            // If no slot found, return null
            return null;
        };

        return findSlot();
    }

    const normalizeDate = (dateTime: string) => {
        const date = new Date(dateTime['dateTime']);
        const options: Intl.DateTimeFormatOptions = {
            timeZone: dateTime['timeZone'],
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        };
        return new Intl.DateTimeFormat('en-US', options).format(date);
    }

    const cleanData = (data: any) => {
        return data.map((event: any) => {
            var readable = normalizeDate(event.start) + " - " + normalizeDate(event.end);
            return {
                summary: event.summary,
                time: readable,
                start: event.start.dateTime,
                end: event.end.dateTime,
                recurrence: event.recurrence ? 'Weekly' : 'None'
            };
        });
    }

    const fetchEvents = async () => {
        try {
            const response1 = await axios.get('http://127.0.0.1:5000/get-events', {
            });

            var events = response1.data;

            events = cleanData(events);
            console.log(events);
            setEvents([...events]);
        } catch (error: any) {
            if (error.response && error.response.status === 401) {
                alert("You are not authenticated. Please authorize your Google account.");
                await handleAuthorize(); // Trigger authorization
            } else {
                console.error("Error fetching events:", error);
            }
        }
    };



    return (
        <div>
            <h1>Date Finder</h1>
            {loadComponent()}
        </div>
    );
};

export default App;
