import { Link } from 'react-router-dom';
import LineIcon from '../LineIcon/LineIcon';
import './InfoCard.css';
export default function InfoCard({ icon, title, text, to }) {
  const Wrapper = to ? Link : 'div';
  const props = to ? { to, className:'info-card', style:{textDecoration:'none'} } : { className:'info-card' };
  return (
    <Wrapper {...props}>
      <div className="info-card__icon"><LineIcon name={icon} /></div>
      <h3 className="info-card__title">{title}</h3>
      <p className="info-card__text">{text}</p>
    </Wrapper>
  );
}
