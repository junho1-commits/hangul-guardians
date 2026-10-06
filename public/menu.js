'use strict';
const teacher=location.pathname.replace(/\/$/,'')==='/host'||new URLSearchParams(location.search).get('role')==='teacher';
if(teacher){
  document.title='한글 지킴이 · 교사 화면';
  document.querySelector('.eyebrow').textContent='교사 화면 · 우리말과 함께 놀아요';
  const grid=document.getElementById('modeGrid');grid.classList.add('teacher-modes');
  for(const link of grid.querySelectorAll('a')){const url=new URL(link.href);url.searchParams.set('role','teacher');link.href=url.href;}
  const card=document.createElement('a');card.className='mode-card';card.href='/host?room=1';
  card.innerHTML='<span>교사용</span><h2>방 개설</h2><p>우리 반의 대기실을 만들고 함께 하는 게임을 진행해요.</p><strong>대기실 만들기 →</strong>';grid.append(card);
}else{document.querySelector('.eyebrow').textContent='학생 화면 · 우리말과 함께 놀아요';}
