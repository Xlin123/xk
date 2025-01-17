import os
import requests
import google_auth_oauthlib
from sys import argv
from flask import Flask, jsonify, redirect, request, session, url_for
from flask_cors import CORS, cross_origin
from dotenv import load_dotenv
from oauth2client import client
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

app = Flask(__name__)
CORS(app, resources={r"/": {"origins": "http://localhost:3000"}})
app.config['CORS_HEADERS'] = 'Content-Type'
load_dotenv()
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.freebusy	']
MERGED_CAL = os.getenv('MERGED_CAL')
XAVIER_CAL = os.getenv('XAVIER_CAL')
KAITLYN_CAL = os.getenv('KAITLYN_CAL')
CLIENT_SECRETS_FILE = "credentials.json"
SCOPES = ['https://www.googleapis.com/auth/calendar.events.owned',
          'https://www.googleapis.com/auth/calendar.readonly']
API_SERVICE_NAME = 'calendar'
API_VERSION = 'v3'

app = Flask(__name__)
def auth():
	creds = None
	if os.path.exists("token.json"):
		creds = Credentials.from_authorized_user_file("token.json", SCOPES)
	# If there are no (valid) credentials available, let the user log in.
	if not creds or not creds.valid:
		if creds and creds.expired and creds.refresh_token:
			creds.refresh(Request())
		else:
			flow = InstalledAppFlow.from_client_secrets_file(
				"credentials.json", SCOPES
			)
			creds = flow.run_local_server(port=34658)
		# Save the credentials for the next run
		with open("token.json", "w") as token:
			token.write(creds.to_json())

	return creds

@app.route('/get-events', methods=['GET'])
@cross_origin()
def get_all_events():
    try:
        creds = auth()
        service = build(API_SERVICE_NAME, API_VERSION, credentials=creds)
        kaitlyn_cal = service.events().list(calendarId=KAITLYN_CAL).execute()
        xavier_cal = service.events().list(calendarId=XAVIER_CAL).execute()
        events = xavier_cal['items'] + kaitlyn_cal['items']
        events = [event for event in events if event.get('status') != 'cancelled']
        return jsonify(events)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(ssl_context='adhoc', debug=True)
