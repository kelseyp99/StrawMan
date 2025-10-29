import React from 'react';

const About: React.FC = () => (
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
				<span style={{ color: '#bbb', fontSize: 14 }}>AdSense Ad 1</span>
			</div>
			<div style={{ width: 120, height: 300, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<span style={{ color: '#bbb', fontSize: 14 }}>AdSense Ad 2</span>
			</div>
		</div>
		{/* Main content */}
		<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
			<h2 style={{ color: '#2d3a4a', marginBottom: 24 }}>About StrawMan</h2>
			<div style={{ maxWidth: 700, textAlign: 'left', color: '#2d3a4a', fontSize: 18 }}>
				<h3>Polls</h3>
				<p>
					StrawMan lets users participate in decentralized polls to predict outcomes of elections and other events. Each poll is transparent, verifiable, and open to all. Results are recorded on-chain for full auditability.
				</p>
				<h3>Betting</h3>
				<p>
					Users can place bets on poll outcomes using candidate coins. Bets are managed by smart contracts, ensuring fair payouts and secure handling of funds. Winners receive their share automatically after results are finalized.
				</p>
				<h3>Tokenomics</h3>
				<p>
					<b>Candidate Coins:</b> Each candidate has a fungible token (FT) that represents fractional ownership and voting power. Coins are initially minted to the house franchise treasury and sold to users. Proceeds are split: 70% to a liquidity pool for market stability, 30% to the house treasury.
				</p>
				<p>
					<b>House Franchise Token:</b> The house franchise token allows decentralized ownership of the platform. Holders receive airdrops from house fees and can participate in governance. Airdrops are distributed to coin holders based on their balance at snapshot time.
				</p>
				<p>
					<b>Payouts & Airdrops:</b> After each event, winners are paid out automatically. House fees are collected and distributed to franchise token holders via airdrop. All transactions are managed by smart contracts for transparency and security.
				</p>
			</div>
		</div>
	</div>
);

export default About;
