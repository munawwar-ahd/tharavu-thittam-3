// Footer.tsx — Team footer with i18n

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

interface TeamMember {
  id: string;
  name: string;
  photo: string | null;
}

const TEAM_MEMBERS: TeamMember[] = [
  { id: '1', name: 'Munawwar Ahmed', photo: '/team/munawwar.jpg' },
  { id: '2', name: 'Liyakhad Ali', photo: '/team/liyakhad.jpg' },
  { id: '3', name: 'Deena', photo: '/team/deena.jpg' },
  { id: '4', name: 'Mohamed Wasim', photo: '/team/wasim.jpg' },
];

export function Footer() {
  const { t } = useI18n();
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    if (showModal) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setShowModal(false);
  };

  const handleOpen = () => setShowModal(true);
  const handleClose = () => setShowModal(false);

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-content">
        <p className="footer-text">{t('footer.designed_by')}</p>
        <p className="footer-team">Team Thunderbolts*</p>
        <button
          ref={triggerRef}
          className="btn-team"
          onClick={handleOpen}
          aria-haspopup="dialog"
          aria-label={t('footer.team_members')}
        >
          {t('footer.team_members')}
        </button>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={handleOverlayClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={handleClose}
              aria-label={t('common.close')}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h3 id="modal-title" className="modal-title">{t('footer.modal_title')}</h3>
            <div className="modal-team-grid">
              {TEAM_MEMBERS.map((member) => (
                <div key={member.id} className="team-member-card">
                  <div className="team-member-photo">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} />
                    ) : (
                      <div className="photo-placeholder" aria-hidden="true">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M20 21c0-5.5-3.5-10-8-10S4 15.5 4 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="team-member-name">{member.name}</p>
                </div>
              ))}
            </div>
            <p className="modal-note">{t('footer.modal_note')}</p>
          </div>
        </div>
      )}
    </footer>
  );
}