import React, { useEffect, useState } from 'react';
import axios from 'axios';

const App: React.FC = () => {
    const kaitlynCalendarId = 'eebeae667ad0eceb874702989fb64de7960eaabe3c8eb3320fae61e6dd43621d@group.calendar.google.com';
    const xavierCalendarId = 'b46770b152d7306add2f8888531a6d315142be594d3ceeba01e43f91121d7504@group.calendar.google.com';
    const [timeMin, setTimeMin] = useState('');
    const [timeMax, setTimeMax] = useState('');
    const [email, setEmail] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [events, setEvents] = useState<any[]>([]);

    const handleAuthorize = async () => {
        try {
            const response = await axios.get('https//127.0.0.1:5000/authorize');
            const authUrl = response.data.auth_url;
            window.location.href = authUrl; // Redirect to Google's auth page
            setAuthenticated(true);
            setEmail(response.data.email);
        } catch (error) {
            console.error("Authorization error:", error);
        }
    };

    const fetchEvents = async () => {
        try {
            const response1 = await axios.post('https://127.0.0.1:5000/get-events', {
                userEmail: email,
                calendarId: kaitlynCalendarId,
                timeMin,
                timeMax,
            });

            const response2 = await axios.post('https://127.0.0.1:5000/get-events', {
                userEmail: email,
                calendarId: xavierCalendarId,
                timeMin,
                timeMax,
            });

            const events1 = response1.data;
            const events2 = response2.data;

            // TODO: Merge events and find the earliest free date

            setEvents([...events1, ...events2]);
        } catch (error: any) {
            if (error.response && error.response.status === 401) {
                alert("You are not authenticated. Please authorize your Google account.");
                await handleAuthorize(); // Trigger authorization
            } else {
                console.error("Error fetching events:", error);
            }
        }
    };

    useEffect(() => {
        // Check if user is already authenticated on component mount
        axios.get(`https://127.0.0.1:5000/check-auth`) // Add an endpoint to verify auth
            .then(() => setAuthenticated(true))
            .catch(() => setAuthenticated(false));
    }, []);

    return (
        <div>
            <h1>Date Finder</h1>
            {
                !authenticated ? (
                    <button onClick={handleAuthorize}>Authorize Google Account</button>
                ) : (
                    <div>
                        <input
                            type="datetime-local"
                            placeholder="Start Time"
                            value={timeMin}
                            onChange={(e) => setTimeMin(e.target.value)}
                        />
                        <input
                            type="datetime-local"
                            placeholder="End Time"
                            value={timeMax}
                            onChange={(e) => setTimeMax(e.target.value)}
                        />
                        <button onClick={fetchEvents}>Find Free Date</button>
                        <ul>
                            {events.map((event, index) => (
                                <li key={index}>{event.summary}</li>
                            ))}
                        </ul>
                    </div>
                )
            }
        </div>
    );
};

export default App;
