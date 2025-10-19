import React from 'react';

const Tables: React.FC = () => (
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
			<h2 style={{ color: '#2d3a4a', marginBottom: 24 }}>Tables Page (Web)</h2>
			{/* Add your tables UI here */}
		</div>
	</div>
);

export default Tables;
