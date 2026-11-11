// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useEffect } from 'react';

const Loader = () => {
  useEffect(() => {
    const loader = document.querySelector('.loader');
    loader.style.display = '';
    return () => (loader.style.display = 'none');
  }, []);
  return null;
};

export default Loader;
