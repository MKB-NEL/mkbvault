
import React from 'react';

export const Icon = ({ icon, className = '', style = {} }) => (
  <iconify-icon icon={icon} class={className} style={style}></iconify-icon>
);
