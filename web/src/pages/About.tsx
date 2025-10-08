
import React from 'react';
import './About.css';

const About: React.FC = () => (
	<div className="about-container">
		<h1>About StrawMan</h1>
		<p>
			StrawMan is a simple, informal voting app designed for open participation. Users can log in and vote as many times as they want, with each vote securely logged in Firebase and assigned a unique log number. Your personal voting history is always available, so you can see every vote you've cast—including multiple votes on the same topic.
		</p>
		<p>
			StrawMan is built for transparency and privacy. Third parties can view aggregate voting results and demographic breakdowns, but never see individual names or personal information. This means you can vote freely, and your demographic data helps inform the community without compromising your privacy.
		</p>
		<p>
			The goal: make voting open, accessible, and useful for everyone—while keeping your identity safe. Enjoy StrawMan and help shape the conversation!
		</p>
	</div>
);

export default About;
