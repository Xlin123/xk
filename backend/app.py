from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
import pickle




app = Flask(__name__)
CORS(app)
load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
ALLOWED_EMAILS = os.getenv('ALLOWED_EMAILS').split(',')
MERGED_CAL = os.getenv('MERGED_CAL')

@app.route('/authorize', methods=['GET'])
def authorize():
    flow = InstalledAppFlow.from_client_secrets_file(
        'credentials.json', SCOPES,
        redirect_uri='https://localhost:5000/oauth-callback'  # Update this for production
    )
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    return jsonify({"auth_url": authorization_url})

@app.route('/oauth-callback', methods=['GET'])
def oauth_callback():
    try:
        flow = InstalledAppFlow.from_client_secrets_file(
            'credentials.json', SCOPES,
            redirect_uri='https://localhost:5000/oauth-callback'
        )

        authorization_response = request.url 
        print(f"Authorization response: {authorization_response}")
        flow.fetch_token(authorization_response=authorization_response)

        creds = flow.credentials
        user_info_service = build('oauth2', 'v2', credentials=creds)
        user_info = user_info_service.userinfo().get().execute()
        user_email = user_info.get('email')

        # Save credentials per user
        token_path = f'tokens/{user_email}.pickle'
        with open(token_path, 'wb') as token:
            pickle.dump(creds, token)

        return jsonify({"message": "Authorization successful.", "userEmail": user_email})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/check-auth', methods=['GET'])
def check_auth():
    user_email = request.args.get('userEmail')
    token_path = f'tokens/{user_email}.pickle'

    if os.path.exists(token_path):
        return jsonify({"authenticated": True})
    else:
        return jsonify({"authenticated": False}), 401

@app.route('/get-events', methods=['POST'])
def get_events():
    try:
        user_email = request.json.get('userEmail')

        if user_email not in ALLOWED_EMAILS:
            app.logger.warning(f"Unauthorized access attempt by {user_email}")
            return jsonify({"error": "Unauthorized user"}), 403

        token_path = f'tokens/{user_email}.pickle'
        if not os.path.exists(token_path):
            return jsonify({"error": "User not authenticated"}), 401

        with open(token_path, 'rb') as token_file:
            creds = pickle.load(token_file)

        service = build('calendar', 'v3', credentials=creds)

        body = request.json
        calendar_id = body.get("calendarId")
        time_min = body.get("timeMin")
        time_max = body.get("timeMax")

        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()

        events = events_result.get('items', [])
        return jsonify(events)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(ssl_context='adhoc', debug=True)
