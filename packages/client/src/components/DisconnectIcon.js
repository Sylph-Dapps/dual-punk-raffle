import React from 'react';

import './DisconnectIcon.scss';

function DisconnectIcon(props) {
  return (
    <div className="DisconnectIcon" {...props}>
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 4h3a2 2 0 0 1 2 2v1m-5 13h3a2 2 0 0 0 2-2v-1M4.425 19.428l6 1.8A2 2 0 0 0 13 19.312V4.688a2 2 0 0 0-2.575-1.916l-6 1.8A2 2 0 0 0 3 6.488v11.024a2 2 0 0 0 1.425 1.916zM9.001 12H9m7 0h5m0 0-2-2m2 2-2 2"/></svg>
    </div>
  );
}

export default DisconnectIcon;