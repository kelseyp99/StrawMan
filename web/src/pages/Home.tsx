
import React from 'react';
import AdSenseAd from '../components/AdSenseAd';

const Home: React.FC = () => {
		return (
			<div style={{
				minHeight: '100vh',
				background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
				display: 'flex',
				flexDirection: 'row',
				alignItems: 'stretch',
				justifyContent: 'center',
				padding: '2rem',
			}}>
				{/* Left AdSense ads */}
				<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', width: 120, minWidth: 120, marginRight: 24 }}>
					<div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						{/* AdSense ad slot 1 */}
						<AdSenseAd style={{ width: 120, height: 300, display: 'block' }} />
					</div>
					<div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						{/* AdSense ad slot 2 */}
						<AdSenseAd style={{ width: 120, height: 300, display: 'block' }} />
					</div>
				</div>

				{/* Main content */}
				<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
					<img
						src="/StrawMan.png"
						alt="StrawMan Logo"
						style={{ width: 180, marginBottom: 24, borderRadius: 16, boxShadow: '0 4px 16px #0001' }}
					/>
					<h1 style={{ fontSize: '2.5rem', color: '#2d3a4a', marginBottom: 8 }}>Welcome to StrawMan Voting</h1>
					<h2 style={{ fontWeight: 400, color: '#4a6073', marginBottom: 32 }}>Your simple, secure, and transparent voting platform</h2>
					<div style={{
						background: '#fff',
						borderRadius: 16,
						boxShadow: '0 2px 12px #0001',
						padding: '2rem',
						maxWidth: 480,
						textAlign: 'left',
						marginBottom: 32
					}}>
						<h3 style={{ color: '#2d3a4a', marginBottom: 12 }}>What to do next:</h3>
						<ol style={{ color: '#4a6073', fontSize: '1.1rem', lineHeight: 1.7 }}>
							<li><strong>Log in</strong> or create an account using the button at the top right.</li>
							<li>Go to the <strong>Ballot</strong> tab to view and vote in your current election.</li>
							<li>Check the <strong>Reports</strong> tab to see live vote totals for your election.</li>
							<li>Use the <strong>Tables</strong> tab to view or manage election data (admin only).</li>
							<li>Visit <strong>About</strong> for more information about this platform.</li>
						</ol>
						<p style={{ marginTop: 18, color: '#2d3a4a' }}>
							<strong>Need help?</strong> Contact your election administrator or see the About page.
						</p>
					</div>
					<div style={{ color: '#4a6073', fontSize: '1.1rem', marginTop: 12 }}>
						<span role="img" aria-label="lock">🔒</span> Your vote is private and secure.
					</div>
				</div>
			</div>
		);
};

export default Home;
