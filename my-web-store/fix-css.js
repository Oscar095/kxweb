const fs = require('fs');
let oldCss = fs.readFileSync('old_main.css', 'utf8');

const custom = `
/* --- CUSTOM ANTIGRAVITY CSS APPEND --- */
/* Announcement Bar Overlay */
.announcement-bar {
	background-color: #009FE3;
	color: #fff;
	text-align: center;
	font-size: 0.85rem;
	font-weight: 600;
	letter-spacing: 0.5px;
	padding: 0;
	z-index: 200;
	position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 30px;
}
.announcement-fade-container {
	position: relative;
	height: 30px;
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
}
.announce-item {
	position: absolute;
	opacity: 0;
	transition: opacity 0.5s ease-in-out;
	pointer-events: none;
}
.announce-item.active {
	opacity: 1;
	pointer-events: auto;
}

/* Hero Banner Integration */
.hero-inner-glass {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

/* Benefits Section (Por qué elegirnos) */
.benefits-section-wrap {
	width: 100%;
	background: #0E1628;
	padding: 60px 0;
	margin-top: 40px;
	margin-bottom: 40px;
	position: relative;
	z-index: 5;
}
.benefits-section {
	padding: 0 24px;
	text-align: center;
}
.benefits-title {
	font-size: 2.5rem;
	margin-bottom: 48px;
	color: #fff;
}
.benefits-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 20px;
	max-width: 1200px;
	margin: 0 auto;
}
.benefit-card {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	padding: 32px 24px;
	text-align: center;
}
.benefit-icon svg {
	width: 40px;
	height: 40px;
}
.benefit-card h3 {
	font-size: 1.15rem;
	margin-bottom: 4px;
	color: #fff;
	font-weight: 700;
}
.benefit-card h3 span {
	display: block;
	color: var(--primary);
	font-size: 1.05rem;
	margin-top: 4px;
}
.benefit-card p {
	color: #a0aec0;
	line-height: 1.4;
	font-size: 0.85rem;
	margin: 0;
}
@media (max-width: 900px) {
	.benefits-grid {
		grid-template-columns: repeat(2, 1fr);
	}
}
@media (max-width: 500px) {
	.benefits-grid {
		grid-template-columns: 1fr;
	}
}

/* Contact Page Modern Redesign */
.contact-layout-modern {
	display: grid;
	grid-template-columns: 1fr 1.2fr;
	gap: 60px;
	max-width: 1100px;
	margin: 0 auto;
	align-items: start;
}
.contact-info-col {
	display: flex;
	flex-direction: column;
	gap: 24px;
}
.contact-info-col h1 {
	font-size: 2.5rem;
	color: var(--text-main);
	margin-bottom: 8px;
	line-height: 1.2;
}
.contact-info-col > p {
	font-size: 1.1rem;
	color: var(--muted);
	margin-bottom: 16px;
}
.contact-cards {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.contact-card-item {
	display: flex;
	align-items: center;
	gap: 16px;
	background: var(--glass-bg);
	padding: 20px;
	border-radius: 16px;
	border: 1px solid var(--glass-border);
}
.contact-card-icon {
	width: 48px;
	height: 48px;
	border-radius: 50%;
	background: rgba(0, 159, 227, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--primary);
}
.contact-card-text h4 {
	margin: 0 0 4px 0;
	font-size: 1rem;
	color: var(--text-main);
}
.contact-card-text p {
	margin: 0;
	font-size: 0.95rem;
	color: var(--muted);
}
.whatsapp-cta-card {
	margin-top: 16px;
	background: linear-gradient(135deg, #25D366, #128C7E);
	border-radius: 16px;
	padding: 24px;
	color: #fff;
	text-align: center;
	box-shadow: 0 10px 30px rgba(37, 211, 102, 0.3);
}
.whatsapp-cta-card h3 {
	color: #fff;
	font-size: 1.5rem;
	margin-bottom: 12px;
}
.whatsapp-cta-card p {
	color: rgba(255, 255, 255, 0.9);
	margin-bottom: 20px;
}
.btn-whatsapp-large {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	background: #fff;
	color: #128C7E;
	padding: 14px 28px;
	border-radius: 30px;
	font-weight: bold;
	text-decoration: none;
	transition: transform 0.3s;
}
.btn-whatsapp-large:hover {
	transform: scale(1.05);
}
.contact-form.modern-form {
	background: #fff;
	padding: 40px;
	border-radius: 24px;
	box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
}
.form-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 20px;
}
.form-group {
	margin-bottom: 20px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.form-group label {
	font-weight: 600;
	font-size: 0.9rem;
	color: var(--text-main);
}
.contact-form.modern-form input,
.contact-form.modern-form textarea {
	padding: 14px 16px;
	border: 1px solid #e2e8f0;
	border-radius: 12px;
	background: #f8fafc;
	font-size: 1rem;
	transition: all 0.3s ease;
}
.contact-form.modern-form input:focus,
.contact-form.modern-form textarea:focus {
	outline: none;
	border-color: var(--primary);
	background: #fff;
	box-shadow: 0 0 0 3px rgba(0, 159, 227, 0.1);
}
.form-submit-btn {
	width: 100%;
	padding: 16px;
	font-size: 1.1rem;
	border-radius: 12px;
	margin-top: 10px;
}
@media (max-width: 900px) {
	.contact-layout-modern {
		grid-template-columns: 1fr;
	}
	.form-row {
		grid-template-columns: 1fr;
	}
}

/* Footer Gradient */
.site-footer {
	background: linear-gradient(to bottom, #ffffff 0%, #e0f2fe 100%);
}
`;

// Remove BOM if present
if (oldCss.charCodeAt(0) === 0xFEFF) {
  oldCss = oldCss.slice(1);
}
// Strip null bytes in case it is UTF-16 dumped as UTF-8
oldCss = oldCss.replace(/\0/g, '');

const finalCss = oldCss.trim() + '\n\n' + custom;
fs.writeFileSync('src/styles/main.css', finalCss, { encoding: 'utf8' });
console.log('Cleaned main.css successfully. No BOM, pure UTF-8.');
