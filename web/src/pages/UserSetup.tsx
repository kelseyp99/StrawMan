import React, { useState } from 'react';
// import PlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-places-autocomplete';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const UserSetup: React.FC = () => {
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    gender: '',
    race: '',
    age: '',
    education: '',
    occupation: '',
    party: '',
    other: '',
  });
  const [ballotStatus, setBallotStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddressChange = (address: string) => {
  setForm({ ...form, address });
  };

  const handleAddressSelect = async (address: string) => {
  // Autocomplete removed for build stability
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      await setDoc(doc(db, 'Users', user.uid), {
        ...form,
        updatedAt: new Date(),
      }, { merge: true });
      setSaved(true);
    } catch (err) {
      alert('Error saving: ' + err);
    }
    setSaving(false);
  };

  async function handleDownloadBallot() {
    setBallotStatus('Downloading ballot...');
    try {
      const fullAddress = `${form.address}, ${form.city}, ${form.state} ${form.zip}`;
      // Query Google Civic API (replace with your backend proxy if needed)
      const civicApiKey = process.env.REACT_APP_CIVIC_API_KEY;
      const url = `https://civicinfo.googleapis.com/civicinfo/v2/voterinfo?address=${encodeURIComponent(fullAddress)}&key=${civicApiKey}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Civic API error');
      const data = await response.json();
      // Extract election info
      const election = data.election;
      if (!election) throw new Error('No election found for address');
      // Election PK: use id from Civic or hash
      const electionId = election.id || btoa(election.name + election.electionDay);
      // Save or update election in Elections table
      // (Assume Firestore structure: Elections/{electionId})
      await setDoc(doc(db, 'Elections', electionId), {
        ...election,
        updatedAt: new Date(),
      }, { merge: true });
      // Assign electionId to user
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      await setDoc(doc(db, 'Users', user.uid), {
        ...form,
        electionId,
        updatedAt: new Date(),
      }, { merge: true });
      // Candidates
      if (data.contests) {
        for (const contest of data.contests) {
          if (contest.candidates) {
            for (const candidate of contest.candidates) {
              // Candidate PK: hash of name + electionId
              const candidatePK = btoa(candidate.name + electionId);
              await setDoc(doc(db, 'Candidates', candidatePK), {
                ...candidate,
                electionId,
                pk: candidatePK,
                updatedAt: new Date(),
              }, { merge: true });
            }
          }
        }
      }
      setBallotStatus('Ballot downloaded and saved!');
    } catch (err: any) {
      setBallotStatus('Error: ' + err.message);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 24 }}>
      <h2>User Setup (Optional)</h2>
      <form onSubmit={handleSubmit}>
        <label>Name (optional):<br />
          <input name="name" value={form.name} onChange={handleChange} />
        </label><br /><br />
        <label>Address (required for ballot):<br />
          <input name="address" value={form.address} onChange={handleChange} required placeholder="Enter your address" />
        </label><br /><br />
        <label>City:<br />
          <input name="city" value={form.city} onChange={handleChange} />
        </label><br /><br />
        <label>State:<br />
          <select name="state" value={form.state} onChange={handleChange} required>
            <option value="">Select State</option>
            <option value="AL">Alabama</option>
            <option value="AK">Alaska</option>
            <option value="AZ">Arizona</option>
            <option value="AR">Arkansas</option>
            <option value="CA">California</option>
            <option value="CO">Colorado</option>
            <option value="CT">Connecticut</option>
            <option value="DE">Delaware</option>
            <option value="FL">Florida</option>
            <option value="GA">Georgia</option>
            <option value="HI">Hawaii</option>
            <option value="ID">Idaho</option>
            <option value="IL">Illinois</option>
            <option value="IN">Indiana</option>
            <option value="IA">Iowa</option>
            <option value="KS">Kansas</option>
            <option value="KY">Kentucky</option>
            <option value="LA">Louisiana</option>
            <option value="ME">Maine</option>
            <option value="MD">Maryland</option>
            <option value="MA">Massachusetts</option>
            <option value="MI">Michigan</option>
            <option value="MN">Minnesota</option>
            <option value="MS">Mississippi</option>
            <option value="MO">Missouri</option>
            <option value="MT">Montana</option>
            <option value="NE">Nebraska</option>
            <option value="NV">Nevada</option>
            <option value="NH">New Hampshire</option>
            <option value="NJ">New Jersey</option>
            <option value="NM">New Mexico</option>
            <option value="NY">New York</option>
            <option value="NC">North Carolina</option>
            <option value="ND">North Dakota</option>
            <option value="OH">Ohio</option>
            <option value="OK">Oklahoma</option>
            <option value="OR">Oregon</option>
            <option value="PA">Pennsylvania</option>
            <option value="RI">Rhode Island</option>
            <option value="SC">South Carolina</option>
            <option value="SD">South Dakota</option>
            <option value="TN">Tennessee</option>
            <option value="TX">Texas</option>
            <option value="UT">Utah</option>
            <option value="VT">Vermont</option>
            <option value="VA">Virginia</option>
            <option value="WA">Washington</option>
            <option value="WV">West Virginia</option>
            <option value="WI">Wisconsin</option>
            <option value="WY">Wyoming</option>
          </select>
        </label><br /><br />
        <label>Zip:<br />
          <input name="zip" value={form.zip} onChange={handleChange} />
        </label><br /><br />
        <label>Gender (optional):<br />
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="nonbinary">Non-binary</option>
            <option value="other">Other</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
        </label><br /><br />
        <label>Race/Ethnicity (optional):<br />
          <select name="race" value={form.race} onChange={handleChange}>
            <option value="">Select...</option>
            <option value="asian">Asian</option>
            <option value="black">Black/African American</option>
            <option value="hispanic">Hispanic/Latino</option>
            <option value="native">Native American</option>
            <option value="white">White</option>
            <option value="other">Other</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
        </label><br /><br />
        <label>Age (optional):<br />
          <input name="age" value={form.age} onChange={handleChange} type="number" min="18" max="120" />
        </label><br /><br />
        <label>Education Level (optional):<br />
          <select name="education" value={form.education} onChange={handleChange}>
            <option value="">Select...</option>
            <option value="none">No formal education</option>
            <option value="highschool">High school diploma or equivalent</option>
            <option value="somecollege">Some college, no degree</option>
            <option value="associate">Associate degree</option>
            <option value="bachelor">Bachelor's degree</option>
            <option value="master">Master's degree</option>
            <option value="doctorate">Doctorate or professional degree</option>
            <option value="other">Other</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
        </label><br /><br />
        <label>Occupation (optional):<br />
          <input name="occupation" value={form.occupation} onChange={handleChange} />
        </label><br /><br />
        <label>Political Party (optional):<br />
          <select name="party" value={form.party} onChange={handleChange}>
            <option value="">Select...</option>
            <option value="democratic">Democratic</option>
            <option value="republican">Republican</option>
            <option value="libertarian">Libertarian</option>
            <option value="green">Green</option>
            <option value="constitution">Constitution</option>
            <option value="independent">Independent</option>
            <option value="other">Other</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
        </label><br /><br />
        <label>Other (optional):<br />
          <input name="other" value={form.other} onChange={handleChange} />
        </label><br /><br />
        <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Info'}</button>
      </form>
      <button style={{ marginTop: 16 }} onClick={handleDownloadBallot}>Download Ballot</button>
      {ballotStatus && <div style={{ marginTop: 12, color: ballotStatus.startsWith('Error') ? 'red' : 'green' }}>{ballotStatus}</div>}
      {saved && <div style={{ color: 'green', marginTop: 16 }}>Saved!</div>}
      <p style={{ marginTop: 24, fontSize: 14, color: '#555' }}>
        All fields are optional except address, city, state, and zip, which are needed to determine your ballot. Demographic info helps improve political polling and research.
      </p>
    </div>
  );
};

export default UserSetup;