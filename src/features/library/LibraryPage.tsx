import { Link } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';

export function LibraryPage() {
  return (
    <>
      <TopBar title="Library" />
      <div className={page.content}>
        <div className={page.empty}>
          <p>No content imported yet.</p>
          <p>
            <Link to="/library/import">Import content</Link>
          </p>
        </div>
      </div>
    </>
  );
}
