import React, { useState, useEffect } from 'react';
import AdSenseAd from '../components/AdSenseAd';
// import PlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-places-autocomplete';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const UserSetup: React.FC = () => {
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    gender: '',
    genderIdentity: '',
    sexualOrientation: '',
    race: '',
    age: '',
    education: '',
    occupation: '',
    party: '',
    income: '',
    maritalStatus: '',
    religion: '',
    veteran: '',
    disability: '',
    homeOwnership: '',
    employmentStatus: '',
    union: '',
    language: '',
    citizenship: '',
    other: '',
  });
  const [ballotStatus, setBallotStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [openRouterModel, setOpenRouterModel] = useState('openai/gpt-4o');

  useEffect(() => {
    const loadData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      // Load user data
      const userDoc = await getDoc(doc(db, 'Users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setForm(prev => ({ ...prev, ...data }));
        // Load openRouterKey and openRouterModel from Firestore
        setOpenRouterKey(data?.openRouterKey || '');
        setOpenRouterModel(data?.openRouterModel || 'openai/gpt-4o');
      }
    };
    loadData();
  }, []);

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
        openRouterKey,
        openRouterModel,
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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
      {/* Left AdSense ads */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', width: 120, minWidth: 120, marginRight: 24 }}>
        <div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AdSenseAd style={{ width: 120, height: 300, display: 'block' }} />
        </div>
        <div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AdSenseAd style={{ width: 120, height: 300, display: 'block' }} />
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {/* Banner ad across top of right-side content */}
        <div style={{ width: '100%', marginBottom: 12 }}>
          <AdSenseAd variant="banner" />
        </div>
        <h2>Welcome! Tell Us About Yourself</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
        <div>
          <h3>Contact & Location</h3>
          <label>Name (optional):<br />
            <input name="name" value={form.name} onChange={handleChange} />
          </label><br /><br />
          <label style={{ fontWeight: 'bold' }}>Address <span style={{ color: '#c00' }}>*</span> (required for ballot):<br />
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
          <label>Language(s) spoken at home:<br />
            <input name="language" value={form.language} onChange={handleChange} />
          </label><br /><br />
          <label>Country of birth / Citizenship:<br />
            <input name="citizenship" value={form.citizenship} onChange={handleChange} />
          </label><br /><br />
        </div>
        <div>
          <h3>Personal & Demographic</h3>
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
          <label>Gender Identity (optional):<br />
            <select name="genderIdentity" value={form.genderIdentity} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="cisgender">Cisgender</option>
              <option value="transgender">Transgender</option>
              <option value="nonbinary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Sexual Orientation (optional):<br />
            <select name="sexualOrientation" value={form.sexualOrientation} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="heterosexual">Heterosexual</option>
              <option value="homosexual">Homosexual</option>
              <option value="bisexual">Bisexual</option>
              <option value="asexual">Asexual</option>
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
        </div>
        <div>
          <h3>Political & Socioeconomic</h3>
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
          <label>Household Income (optional):<br />
            <select name="income" value={form.income} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="under_25k">Under $25,000</option>
              <option value="25k_50k">$25,000 - $50,000</option>
              <option value="50k_75k">$50,000 - $75,000</option>
              <option value="75k_100k">$75,000 - $100,000</option>
              <option value="100k_150k">$100,000 - $150,000</option>
              <option value="over_150k">Over $150,000</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Marital Status (optional):<br />
            <select name="maritalStatus" value={form.maritalStatus} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Religion (optional):<br />
            <select name="religion" value={form.religion} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="christian">Christian</option>
              <option value="jewish">Jewish</option>
              <option value="muslim">Muslim</option>
              <option value="hindu">Hindu</option>
              <option value="buddhist">Buddhist</option>
              <option value="none">None</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Veteran Status (optional):<br />
            <select name="veteran" value={form.veteran} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Disability Status (optional):<br />
            <select name="disability" value={form.disability} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Home Ownership (optional):<br />
            <select name="homeOwnership" value={form.homeOwnership} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="own">Own</option>
              <option value="rent">Rent</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Employment Status (optional):<br />
            <select name="employmentStatus" value={form.employmentStatus} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="unemployed">Unemployed</option>
              <option value="retired">Retired</option>
              <option value="student">Student</option>
              <option value="other">Other</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Union Membership (optional):<br />
            <select name="union" value={form.union} onChange={handleChange}>
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="prefer_not">Prefer not to say</option>
            </select>
          </label><br /><br />
          <label>Other (optional):<br />
            <input name="other" value={form.other} onChange={handleChange} />
          </label><br /><br />
        </div>
        <div style={{ gridColumn: '1 / span 3' }}>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Info'}</button>
        </div>
        </form>
        <button style={{ marginTop: 16 }} onClick={handleDownloadBallot}>Download Ballot</button>
        {ballotStatus && <div style={{ marginTop: 12, color: ballotStatus.startsWith('Error') ? 'red' : 'green' }}>{ballotStatus}</div>}
        {saved && <div style={{ color: 'green', marginTop: 16 }}>Saved!</div>}
        <p style={{ marginTop: 24, fontSize: 15, color: '#555' }}>
          <strong>Why do we ask?</strong> Sharing a few details helps us improve political polling and research. <br /><br />
          <strong>What is required?</strong> <span style={{ color: '#c00' }}>You must provide an address in your precinct (or your precinct's address) so we can detect your ballot. All other fields are optional.</span>
        </p>

        {/* OpenRouter AI Settings */}
        <div style={{ marginTop: 24, background: '#f0f4ff', border: '1px solid #c0d0f0', borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>🤖 AI Settings (OpenRouter)</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>OpenRouter API Key</label>
            <input
              type="password"
              value={openRouterKey}
              onChange={e => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-..."
              style={{ width: '100%', padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
            />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Model</label>
            <select
              value={openRouterModel}
              onChange={e => setOpenRouterModel(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc' }}
            >
              <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
              <option value="openai/gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
              <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
              <option value="anthropic/claude-3-haiku">Claude 3 Haiku (Anthropic)</option>
              <option value="google/gemini-pro-1.5">Gemini Pro 1.5 (Google)</option>
              <option value="meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 8B (Free)</option>
              <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
            </select>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Browse all models at <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">openrouter.ai/models</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSetup;