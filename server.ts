import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import * as admin from 'firebase-admin';

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not load firebase-applet-config.json:', e);
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Initialize Firebase Admin Firestore with explicit database ID
let firestoreDb: any = null;
try {
  const adminAny = admin as any;
  if (!adminAny.apps || !adminAny.apps.length) {
    adminAny.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  }
  const dbId = firebaseConfig.firestoreDatabaseId;
  if (dbId) {
    firestoreDb = admin.firestore(admin.app(''), dbId);
  } else {
    firestoreDb = admin.firestore();
  }
  console.log('Firebase Admin Firestore initialized successfully with database ID:', dbId || '(default)');
} catch (err: any) {
  console.warn('Firebase Admin init warning (falling back to local storage):', err);
}

// Ensure repository data files are synced into /tmp on Vercel deployments so user uploads are never lost
function syncRepoDataToTmpIfNeeded() {
  if (!isVercel) return;
  try {
    const repoDataDir = path.resolve(process.cwd(), 'data');
    if (fs.existsSync(repoDataDir)) {
      ensureDirs();
      const files = ['users.json', 'forms.json', 'deleted_forms.json', 'posts.json', 'audit_logs.json'];
      files.forEach((f) => {
        const repoFile = path.join(repoDataDir, f);
        const tmpFile = path.join(DATA_DIR, f);
        if (fs.existsSync(repoFile) && !fs.existsSync(tmpFile)) {
          fs.copyFileSync(repoFile, tmpFile);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to sync repo data to /tmp:', e);
  }
}

// Ensure data and uploads directories exist (use /tmp on Vercel for writeable storage)
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true' || process.env.NODE_ENV === 'production';
const DATA_DIR = isVercel ? path.resolve('/tmp', 'data') : path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = isVercel ? path.resolve('/tmp', 'uploads') : path.resolve(process.cwd(), 'uploads');
const FORMS_DIR = path.join(UPLOADS_DIR, 'forms');
const POSTS_DIR = path.join(UPLOADS_DIR, 'posts');

function ensureDirs() {
  [DATA_DIR, UPLOADS_DIR, FORMS_DIR, POSTS_DIR].forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      // ignore
    }
  });
}

// Paths to persistent JSON files
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FORMS_FILE = path.join(DATA_DIR, 'forms.json');
const DELETED_FORMS_FILE = path.join(DATA_DIR, 'deleted_forms.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit_logs.json');

// Helper to read JSON (with Firestore sync support)
function readJson<T>(file: string, fallback: T): T {
  try {
    ensureDirs();
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
  }
  return fallback;
}

// Helper to write JSON safely & sync to Firestore synchronously/awaited for Vercel persistence
async function writeJson(file: string, data: any) {
  try {
    ensureDirs();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    
    // Sync to Firestore if available
    if (firestoreDb) {
      try {
        const fileName = path.basename(file);
        const collectionName = fileName.replace('.json', '');
        const docRef = firestoreDb.collection(collectionName).doc('all_data');
        if (Array.isArray(data)) {
          await docRef.set({ items: data, updatedAt: new Date().toISOString() });
        } else {
          await docRef.set({ data, updatedAt: new Date().toISOString() });
        }
      } catch (fsErr) {
        console.warn('Firestore write sync error:', fsErr);
      }
    }
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
  }
}

// Helper to load from Firestore on startup and merge local & cloud forms robustly
async function loadFromFirestoreIfNeeded() {
  if (!firestoreDb) return;
  try {
    // 1. Sync users, posts, audit_logs
    const collections = ['users', 'posts', 'audit_logs'];
    const files = [USERS_FILE, POSTS_FILE, AUDIT_FILE];
    
    for (let i = 0; i < collections.length; i++) {
      const col = collections[i];
      const file = files[i];
      try {
        const docSnap = await firestoreDb.collection(col).doc('all_data').get();
        if (docSnap.exists) {
          const cloudData = docSnap.data()?.items;
          if (cloudData && Array.isArray(cloudData)) {
            ensureDirs();
            fs.writeFileSync(file, JSON.stringify(cloudData, null, 2), 'utf-8');
          }
        }
      } catch (colErr) {
        // ignore
      }
    }

    // 2. Robust merge for forms & deleted_forms so no uploaded form is ever lost and deleted forms stay deleted
    let localForms = readJson<DocForm[]>(FORMS_FILE, []);
    let localDeleted = readJson<string[]>(DELETED_FORMS_FILE, []);

    let cloudForms: DocForm[] = [];
    let cloudDeleted: string[] = [];

    try {
      const formSnap = await firestoreDb.collection('forms').doc('all_data').get();
      if (formSnap.exists) {
        const items = formSnap.data()?.items;
        if (Array.isArray(items)) cloudForms = items;
      }
      const delSnap = await firestoreDb.collection('deleted_forms').doc('all_data').get();
      if (delSnap.exists) {
        const items = delSnap.data()?.items;
        if (Array.isArray(items)) cloudDeleted = items;
      }
    } catch (e) {
      // ignore
    }

    const allDeleted = Array.from(new Set([...localDeleted, ...cloudDeleted]));

    const formMap = new Map<string, DocForm>();
    [...localForms, ...cloudForms].forEach((f) => {
      if (f && f.id && !allDeleted.includes(f.id)) {
        formMap.set(f.id, f);
      }
    });

    const mergedForms = Array.from(formMap.values());

    ensureDirs();
    fs.writeFileSync(FORMS_FILE, JSON.stringify(mergedForms, null, 2), 'utf-8');
    fs.writeFileSync(DELETED_FORMS_FILE, JSON.stringify(allDeleted, null, 2), 'utf-8');

    await firestoreDb.collection('forms').doc('all_data').set({ items: mergedForms, updatedAt: new Date().toISOString() });
    await firestoreDb.collection('deleted_forms').doc('all_data').set({ items: allDeleted, updatedAt: new Date().toISOString() });

    console.log('Successfully merged and synced forms and deleted forms from Firestore.');
  } catch (e) {
    console.warn('Failed to load initial data from Firestore:', e);
  }
}

// Interfaces
interface User {
  id: string;
  username: string; // login identifier (e.g. 시스템관리자 or custom id)
  name: string;
  department: string;
  position: string;
  password: string; // Plain/simple hash for demonstration
  role: 'admin' | 'user';
  status: 'pending' | 'approved' | 'banned';
  createdAt: string;
  approvedAt?: string;
  bannedAt?: string;
  lastLoginAt?: string;
}

interface DocForm {
  id: string;
  title: string;
  category: string;
  department: string;
  description: string;
  fileName: string;
  fileExt: string;
  filePath: string;
  fileSize: number;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
  downloadCount: number;
  isOfficial: boolean;
}

interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  department: string;
  content: string;
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
  category: string;
  content: string;
  authorId: string;
  authorName: string;
  department: string;
  createdAt: string;
  views: number;
  likes?: number;
  likedBy?: string[];
  status?: string;
  isNotice: boolean;
  comments: PostComment[];
  attachmentName?: string;
  attachmentPath?: string;
}

interface AuditLog {
  id: string;
  userId: string;
  username: string;
  name: string;
  department: string;
  action: string; // e.g. LOGIN, REGISTER, PDF_MERGE, PDF_SPLIT, PDF_EDIT, BG_REMOVE, FORM_DOWNLOAD, FORM_UPLOAD, USER_APPROVE, USER_BAN
  category: 'AUTH' | 'PDF' | 'IMAGE' | 'FORM' | 'ADMIN' | 'BOARD';
  details: string;
  timestamp: string;
  ip?: string;
}

// Initialize seed users if not present
async function initStorage() {
  // 1. Users
  const users = readJson<User[]>(USERS_FILE, []);
  const hasMasterAdmin = users.some(
    (u) => (u.username === '시스템관리자' || u.username === 'admin') && u.role === 'admin'
  );

  if (!hasMasterAdmin) {
    const masterAdmin: User = {
      id: 'admin-master',
      username: '시스템관리자',
      name: '시스템관리자',
      department: '총괄운영 / 전산기획실',
      position: '최고관리자',
      password: '9311', // Requested master password
      role: 'admin',
      status: 'approved',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    };
    users.unshift(masterAdmin);
    await writeJson(USERS_FILE, users);
  }

  // 2. Default Seed Forms (3 Categories: 이용자 양식, 활동지원사 양식, 행정양식)
  const formsFileExists = fs.existsSync(FORMS_FILE);
  let forms = readJson<DocForm[]>(FORMS_FILE, []);

  if (!formsFileExists) {
    const seedFormsMeta = [
      // 1. 이용자 양식
      {
        id: 'form-user-1',
        title: '기관 이용신청서 및 개인정보 수집·이용 동의서',
        category: '이용자 양식',
        department: '상담사례관리팀',
        description: '복지관 및 기관 프로그램 신규 등록 이용인을 위한 기본 이용신청서 및 개인정보 동의 양식입니다.',
        fileName: '이용자_서비스이용신청서.hwp',
        fileExt: 'hwp',
        contentSample: '【기관 이용 신청서】\n성  명: \n생년월일: \n연락처: \n주  소: \n장애유형 및 등급: \n신청 프로그램: \n개인정보 수집 및 이용 동의: [v] 동의함\n신청인: (인)',
        fileSize: 46200,
        isOfficial: true,
      },
      {
        id: 'form-user-2',
        title: '서비스 제공계약서 및 이용자 권리보호 서약서',
        category: '이용자 양식',
        department: '재활사업팀',
        description: '개별 맞춤 재활 및 복지 서비스 제공에 따른 권리 고지 및 표준 이용계약 서식입니다.',
        fileName: '이용자_서비스제공계약서.hwp',
        fileExt: 'hwp',
        contentSample: '【표준 서비스 제공계약서】\n계약당사자: 기관장 및 이용자\n계약기간: 2026.  .  . ~ 2026.  .  .\n서비스내용: 맞춤형 주간재활 및 치료지원\n이용자 권리보장 고지: 완료\n서명날인: 이용자 (인), 기관장 (직인)',
        fileSize: 42100,
        isOfficial: true,
      },
      {
        id: 'form-user-3',
        title: '서비스 변경 및 종결(퇴소) 신청서',
        category: '이용자 양식',
        department: '상담사례관리팀',
        description: '기존 이용 중인 서비스의 시간/종류 변경이나 자진 종결 시 제출하는 양식입니다.',
        fileName: '이용자_서비스변경종결신청서.hwp',
        fileExt: 'hwp',
        contentSample: '【서비스 변경 및 종결 신청서】\n이용자 성명: \n구  분: [ ]서비스 변경  [ ]종결 신청\n사  유: \n담당자 의견: \n신청일자: 2026.  .  .',
        fileSize: 37500,
        isOfficial: true,
      },
      {
        id: 'form-user-4',
        title: '이용자 고충처리 및 건의 접수서',
        category: '이용자 양식',
        department: '기획운영팀',
        description: '기관 시설 이용 중 불편사항 및 개선 건의 시 작성하는 공식 접수 서식입니다.',
        fileName: '이용자_고충접수서.hwp',
        fileExt: 'hwp',
        contentSample: '【이용자 고충 및 건의 접수서】\n접수번호: 2026-고충-001\n건의자 성명: \n건의내용: \n요구사항: \n조치계획 및 결과통보 희망방법: [ ]유선 [ ]서면',
        fileSize: 35000,
        isOfficial: true,
      },

      // 2. 활동지원사 양식
      {
        id: 'form-act-1',
        title: '장애인활동지원 급여제공기록지 (표준서식)',
        category: '활동지원사 양식',
        department: '활동지원팀',
        description: '활동보조, 방문목욕, 방문간호 등 급여 제공 내역을 일자별·시간대별로 기록하는 필수 법정 서식입니다.',
        fileName: '활동지원_급여제공기록지.hwp',
        fileExt: 'hwp',
        contentSample: '【장애인활동지원 급여제공기록지】\n이용자명: \n활동지원사 성명: \n제공일자: 2026.  .  .\n시작시간:  :   / 종료시간:  :  \n서비스내용: 신체활동지원 / 가사활동지원 / 사회활동지원\n확인서명: 활동지원사 (인), 수급자 (인)',
        fileSize: 53200,
        isOfficial: true,
      },
      {
        id: 'form-act-2',
        title: '활동지원사 근무상황부 및 출근부',
        category: '활동지원사 양식',
        department: '활동지원팀',
        description: '월별 배정 수급자별 근무 시간 집계 및 출퇴근 확인용 근무상황부 서식입니다.',
        fileName: '활동지원사_근무상황부_출근부.hwp',
        fileExt: 'hwp',
        contentSample: '【활동지원사 월간 근무상황부】\n근무월: 2026년   월\n지원사 성명: \n담당 수급자명: \n총 근무일수:    일 / 총 지원시간:    시간\n팀장 확인: (인)',
        fileSize: 48900,
        isOfficial: true,
      },
      {
        id: 'form-act-3',
        title: '활동지원 업무일지 및 특이사항(응급상황) 보고서',
        category: '활동지원사 양식',
        department: '활동지원팀',
        description: '서비스 제공 중 수급자 건강 이상, 병원 동행, 사고 발생 등 긴급 특이사항 발생 시 보고하는 서식입니다.',
        fileName: '활동지원사_업무일지_보고서.hwp',
        fileExt: 'hwp',
        contentSample: '【특이사항 및 응급보고서】\n보고일시: 2026.  .  . (  :  )\n수급자명: \n발생경위 및 상태: \n조치사항: 119연락 / 병원이송 / 보호자 통보\n보고자: 활동지원사 (서명)',
        fileSize: 39500,
        isOfficial: true,
      },
      {
        id: 'form-act-4',
        title: '활동지원 서비스 일정변경 및 휴무 신청서',
        category: '활동지원사 양식',
        department: '활동지원팀',
        description: '사전 협의된 서비스 일정 변경이나 병가, 경조사 등으로 인한 일정 조정 시 제출합니다.',
        fileName: '활동지원_일정변경신청서.hwp',
        fileExt: 'hwp',
        contentSample: '【서비스 일정변경 신청서】\n활동지원사: \n수급자 동의여부: [ ]동의완료\n기존일정: 2026.  .  . -> 변경일정: 2026.  .  .\n대체근무자 지정여부: \n사유: ',
        fileSize: 36000,
        isOfficial: true,
      },

      // 3. 행정양식
      {
        id: 'form-adm-1',
        title: '기관 표준 기안서 (일반 기안·보고용)',
        category: '행정양식 및 회계서류',
        department: '기획운영팀',
        description: '사내 공문 및 부서간 업무 협조, 결재 상신용 표준 한글 기안 서식입니다.',
        fileName: '기관표준_기안서_서식.hwp',
        fileExt: 'hwp',
        contentSample: '【기 안 서】\n문서번호: 2026-기안-001\n기 안 자: 직급 성명\n제    목: 2026년도 상반기 기관 업무추진계획 승인의 건\n\n1. 추진목적\n2. 주요내용\n3. 소요예산\n4. 기대효과',
        fileSize: 42560,
        isOfficial: true,
      },
      {
        id: 'form-adm-2',
        title: '지출결의서 및 품의서 양식',
        category: '행정양식 및 회계서류',
        department: '운영지원팀/회계',
        description: '물품 구매, 행사비, 사업운영비 집행 전 지출품의 및 집행 후 영수증 첨부 결의서입니다.',
        fileName: '표준_지출품의_및_지출결의서.hwp',
        fileExt: 'hwp',
        contentSample: '【지 출 결 의 서】\n발의일자: 2026.  .  .\n지출과목: 사업운영비 / 여비 / 수용비\n금    액: 금             원정 (\\             )\n내    역: 첨부 영수증 참조\n영 수 자: (인)',
        fileSize: 51200,
        isOfficial: true,
      },
      {
        id: 'form-adm-3',
        title: '휴가·연차·출장 신청서 (복무규정 서식)',
        category: '행정양식 및 회계서류',
        department: '인사팀/공통',
        description: '연차휴가, 특별휴가, 공가, 병가 및 대외 출장 신청 시 사용하는 복무 결재서식입니다.',
        fileName: '복무_휴가연차출장신청서.hwp',
        fileExt: 'hwp',
        contentSample: '【휴가 및 출장 신청서】\n소    속: \n직    급: \n성    명: \n종    류: [ ]연차 [ ]반차 [ ]병가 [ ]특별휴가 [ ]출장\n기    간: 2026.  .  . ~ 2026.  .  . (  일간)\n사    유: \n업무대행자: 직급 성명 (서명)',
        fileSize: 38400,
        isOfficial: true,
      },
      {
        id: 'form-adm-4',
        title: '기관 대외 표준 공문서 양식',
        category: '행정양식 및 회계서류',
        department: '기획운영팀',
        description: '유관기관 및 지자체, 교육청, 협력기관 송부용 공식 수발신 공문서 표제 양식입니다.',
        fileName: '대외_표준공문서_표제양식.hwp',
        fileExt: 'hwp',
        contentSample: '수신자: 수신처 대표자\n(경유): \n제  목: 협조 요청의 건\n\n1. 귀 기관의 무궁한 발전을 기원합니다.\n2. 관련 근거: ...\n3. 위와 관련하여 아래와 같이 업무 협조를 요청하오니...',
        fileSize: 45056,
        isOfficial: true,
      },
      {
        id: 'form-adm-5',
        title: '물품 구매(수리) 요구서 및 검수조서',
        category: '행정양식 및 회계서류',
        department: '운영지원팀/자산',
        description: '사무용품, 전자기기, 재활/치료용품 구입 요청 및 납품 완료 후 검수 시 작성하는 서식입니다.',
        fileName: '물품구매요구서_및_검수조서.hwp',
        fileExt: 'hwp',
        contentSample: '【물품구매 요구서】\n요구부서: \n품명 / 규격 / 수량 / 단가 / 추정금액\n구입용도: \n검수인 확인: (인)',
        fileSize: 41200,
        isOfficial: true,
      },
    ];

    // Preserve any existing user-uploaded forms that were previously added
    const userUploadedForms = forms.filter((f) => !f.isOfficial);

    forms = seedFormsMeta.map((s) => {
      const diskPath = path.join(FORMS_DIR, s.fileName);
      if (!fs.existsSync(diskPath)) {
        const header = Buffer.from('HWP Document File V5.00\r\n\r\n' + s.contentSample, 'utf-8');
        fs.writeFileSync(diskPath, header);
      }

      return {
        id: s.id,
        title: s.title,
        category: s.category,
        department: s.department,
        description: s.description,
        fileName: s.fileName,
        fileExt: s.fileExt,
        filePath: s.fileName,
        fileSize: s.fileSize,
        uploadedBy: 'admin-master',
        uploaderName: '시스템관리자',
        createdAt: '2026-10-01T09:00:00.000Z',
        downloadCount: Math.floor(Math.random() * 20) + 5,
        isOfficial: true,
      };
    });

    // Add back any custom forms user had created
    forms = [...forms, ...userUploadedForms];
    await writeJson(FORMS_FILE, forms);
  }

  // 3. Default Posts -> 프로그램 이용자 건의사항 (포털/프로그램 이용자 피드백)
  let posts = readJson<Post[]>(POSTS_FILE, []);
  const hasProgramSuggestions = posts.some((p) => p.category === '기능 개선' || p.category === '신규 서식 요청');
  if (!hasProgramSuggestions || posts.length === 0) {
    posts = [
      {
        id: 'post-prog-1',
        title: '[반영완료] PDF 여러 장 병합 시 마우스 순서 변경(위/아래) 기능 건의',
        category: '기능 개선',
        content:
          '스마트 문서지원 포털에서 여러 PDF 서류를 하나로 합칠 때, 파일 업로드 후 상/하 순서를 간편하게 조정할 수 있는 버튼이 있으면 좋겠습니다. 복수의 첨부 증빙서류를 순서대로 취합할 때 매우 필요합니다.',
        authorId: 'user-sample-1',
        authorName: '이지원',
        department: '상담사례관리팀',
        createdAt: '2026-10-13T09:30:00.000Z',
        views: 42,
        likes: 16,
        likedBy: [],
        status: '반영완료',
        isNotice: true,
        comments: [
          {
            id: 'c-101',
            authorId: 'admin-master',
            authorName: '시스템관리자',
            department: '전산기획실',
            content: '소중한 프로그램 건의 감사드립니다. PDF 통합도구 파일 목록에 [위로 이동] 및 [아래로 이동] 순서 재배치 버튼을 적용 완료하였습니다.',
            createdAt: '2026-10-13T14:15:00.000Z',
          },
        ],
      },
      {
        id: 'post-prog-2',
        title: '[반영완료] 활동지원사 급여제공기록지 2026년 최신 개정판 서식 교체 요청',
        category: '신규 서식 요청',
        content:
          '활동지원팀입니다. 보건복지부 최신 지침에 따른 2026년도 신규 활동지원 급여제공기록지 및 출근부 HWP 공식 양식으로 교체 업로드 부탁드립니다.',
        authorId: 'user-sample-2',
        authorName: '박선우',
        department: '활동지원팀',
        createdAt: '2026-10-13T11:00:00.000Z',
        views: 65,
        likes: 23,
        likedBy: [],
        status: '반영완료',
        isNotice: true,
        comments: [
          {
            id: 'c-102',
            authorId: 'admin-master',
            authorName: '시스템관리자',
            department: '전산기획실',
            content: '2026년 개정 표준 서식으로 양식함 내 파일 교체 및 영구 보존 등록을 완료하였습니다. 한글 서식함에서 바로 다운로드하실 수 있습니다.',
            createdAt: '2026-10-13T16:20:00.000Z',
          },
        ],
      },
      {
        id: 'post-prog-3',
        title: '[검토중] 서식함 내 실시간 인기 순위 외 개인별 \'즐겨찾는 양식\' 북마크 기능 희망',
        category: '시스템 개선',
        content:
          '대시보드에 실시간 인기 서식 TOP 4가 네이버 실시간 검색순위처럼 보여서 자주 쓰는 문서를 찾기 아주 편리합니다! 여기에 추가로 직원 각자가 매일 쓰는 서식을 별표(★)로 즐겨찾기해 둘 수 있는 개인 보관함 기능도 있으면 더욱 편리할 것 같습니다.',
        authorId: 'user-sample-3',
        authorName: '김행정',
        department: '기획행정팀',
        createdAt: '2026-10-14T10:15:00.000Z',
        views: 31,
        likes: 18,
        likedBy: [],
        status: '검토중',
        isNotice: false,
        comments: [
          {
            id: 'c-103',
            authorId: 'admin-master',
            authorName: '시스템관리자',
            department: '전산기획실',
            content: '업무 효율성을 높여주는 좋은 제안입니다. 직원별 개인 즐겨찾기 북마크 및 퀵 다운로드 기능을 적극 검토 중에 있습니다.',
            createdAt: '2026-10-14T15:00:00.000Z',
          },
        ],
      },
      {
        id: 'post-prog-4',
        title: '[답변완료] 도장 직인 배경 투명화(누끼) 시 인주 색상 민감도 조절 문의',
        category: '사용 문의',
        content:
          '스캔된 문서에서 붉은색 도장 직인을 추출할 때 문서 배경의 연한 그림자나 얼룩이 함께 따지는 경우가 있습니다. 깨끗하게 붉은 인주만 추출하는 설정 팁을 알려주세요.',
        authorId: 'user-sample-4',
        authorName: '정복지',
        department: '평생교육팀',
        createdAt: '2026-10-14T14:40:00.000Z',
        views: 27,
        likes: 9,
        likedBy: [],
        status: '답변완료',
        isNotice: false,
        comments: [
          {
            id: 'c-104',
            authorId: 'admin-master',
            authorName: '시스템관리자',
            department: '전산기획실',
            content: '누끼따기 도구의 \'배경 임계값/민감도\' 슬라이더를 55~65% 구간에 두시면 종이 그림자는 소거되고 붉은색 인주 선만 선명하게 추출됩니다.',
            createdAt: '2026-10-14T17:30:00.000Z',
          },
        ],
      },
    ];
    await writeJson(POSTS_FILE, posts);
  }

  // 4. Default Audit Logs
  let auditLogs = readJson<AuditLog[]>(AUDIT_FILE, []);
  if (auditLogs.length === 0) {
    auditLogs = [
      {
        id: 'audit-init-1',
        userId: 'admin-master',
        username: '시스템관리자',
        name: '시스템관리자',
        department: '전산기획실',
        action: 'SYSTEM_BOOT',
        category: 'ADMIN',
        details: '스마트 문서업무 포털 시스템 초기화 및 보안 감사기록 시작',
        timestamp: '2026-10-10T09:00:00.000Z',
      },
    ];
    await writeJson(AUDIT_FILE, auditLogs);
  }
}

// Sync repo data to /tmp if needed, then load from Firestore, then init storage at startup
syncRepoDataToTmpIfNeeded();
await loadFromFirestoreIfNeeded();
await initStorage();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to add audit log
async function recordAudit(log: Omit<AuditLog, 'id' | 'timestamp'>) {
  const logs = readJson<AuditLog[]>(AUDIT_FILE, []);
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...log,
    timestamp: new Date().toISOString(),
  };
  logs.unshift(newLog);
  // Keep last 1000 logs
  if (logs.length > 1000) {
    logs.length = 1000;
  }
  await writeJson(AUDIT_FILE, logs);
}

// Multer Storage for HWP forms
const formStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FORMS_DIR);
  },
  filename: (req, file, cb) => {
    // preserve filename with timestamp prefix to prevent overwrite conflicts
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\uAC00-\uD7A3]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const uploadForm = multer({ storage: formStorage, limits: { fileSize: 50 * 1024 * 1024 } });

// ==================== API ROUTES ====================

// --- 1. AUTH ROUTES ---
// Login: handles both master admin ('시스템관리자' / '9311') and registered staff
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '아이디(계정이름)와 비밀번호를 입력해주세요.' });
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password).trim();

  // Check master admin rule: username == '시스템관리자' (or 'admin') and password == '9311'
  if ((cleanUsername === '시스템관리자' || cleanUsername === 'admin') && cleanPassword === '9311') {
    const users = readJson<User[]>(USERS_FILE, []);
    let admin = users.find((u) => u.username === '시스템관리자' || u.username === 'admin');
    if (!admin) {
      admin = {
        id: 'admin-master',
        username: '시스템관리자',
        name: '시스템관리자',
        department: '전산기획실 / 총괄관리',
        position: '최고관리자',
        password: '9311',
        role: 'admin',
        status: 'approved',
        createdAt: new Date().toISOString(),
      };
      users.unshift(admin);
    }
    admin.lastLoginAt = new Date().toISOString();
    await writeJson(USERS_FILE, users);

    await recordAudit({
      userId: admin.id,
      username: admin.username,
      name: admin.name,
      department: admin.department,
      action: 'LOGIN_SUCCESS',
      category: 'AUTH',
      details: '시스템관리자(마스터) 정상 로그인 완료',
    });

    const { password: _, ...safeUser } = admin;
    return res.json({ success: true, user: safeUser });
  }

  // Check registered users
  const users = readJson<User[]>(USERS_FILE, []);
  const foundUser = users.find(
    (u) => (u.username === cleanUsername || u.name === cleanUsername) && u.password === cleanPassword
  );

  if (!foundUser) {
    await recordAudit({
      userId: 'anonymous',
      username: cleanUsername,
      name: '미식별',
      department: '-',
      action: 'LOGIN_FAIL',
      category: 'AUTH',
      details: `로그인 실패 (계정: ${cleanUsername} - 일치하는 계정 정보 없음)`,
    });
    return res.status(401).json({ message: '계정이름 또는 비밀번호가 올바르지 않습니다.' });
  }

  // Check user status
  if (foundUser.status === 'banned') {
    await recordAudit({
      userId: foundUser.id,
      username: foundUser.username,
      name: foundUser.name,
      department: foundUser.department,
      action: 'LOGIN_BLOCKED_BANNED',
      category: 'AUTH',
      details: `차단된 계정 로그인 시도 차단 (${foundUser.name})`,
    });
    return res.status(403).json({
      status: 'banned',
      message: '관리자에 의해 이용이 제한(벤/차단)된 계정입니다. 관리자에게 문의하세요.',
    });
  }

  if (foundUser.status === 'pending') {
    await recordAudit({
      userId: foundUser.id,
      username: foundUser.username,
      name: foundUser.name,
      department: foundUser.department,
      action: 'LOGIN_BLOCKED_PENDING',
      category: 'AUTH',
      details: `미승인 계정 로그인 시도 대기 (${foundUser.name})`,
    });
    return res.status(403).json({
      status: 'pending',
      message: '현재 [관리자 승인 대기] 상태입니다. 기관 관리자의 승인 후 로그인이 가능합니다.',
    });
  }

  // Approved user
  foundUser.lastLoginAt = new Date().toISOString();
  await writeJson(USERS_FILE, users);

  await recordAudit({
    userId: foundUser.id,
    username: foundUser.username,
    name: foundUser.name,
    department: foundUser.department,
    action: 'LOGIN_SUCCESS',
    category: 'AUTH',
    details: `일반 직원 로그인 완료 (${foundUser.name} / ${foundUser.department})`,
  });

  const { password: _, ...safeUser } = foundUser;
  return res.json({ success: true, user: safeUser });
});

// Registration (신규등록) -> Always sets status to 'pending'
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, department, position, phone } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ message: '아이디, 비밀번호, 성명을 모두 입력해주세요.' });
  }

  const cleanUsername = String(username).trim();
  const users = readJson<User[]>(USERS_FILE, []);

  // Prevent duplicate username or reserved names
  if (
    cleanUsername === '시스템관리자' ||
    cleanUsername === 'admin' ||
    users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())
  ) {
    return res.status(400).json({ message: '이미 사용 중이거나 등록할 수 없는 아이디입니다.' });
  }

  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    name: String(name).trim(),
    department: department ? String(department).trim() : '미지정 부서',
    position: position ? String(position).trim() : '직원',
    password: String(password).trim(),
    role: 'user',
    status: 'pending', // Requires admin approval
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeJson(USERS_FILE, users);

  await recordAudit({
    userId: newUser.id,
    username: newUser.username,
    name: newUser.name,
    department: newUser.department,
    action: 'USER_REGISTERED',
    category: 'AUTH',
    details: `신규 회원가입 신청 완료 (승인 대기중: ${newUser.name} / ${newUser.department})`,
  });

  return res.json({
    success: true,
    message: '회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.',
    userId: newUser.id,
  });
});

// --- 2. ADMIN USER & AUDIT MANAGEMENT ---

// Get all users (for admin)
app.get('/api/admin/users', (req, res) => {
  const users = readJson<User[]>(USERS_FILE, []);
  const safeList = users.map(({ password: _, ...u }) => u);
  return res.json({ users: safeList });
});

// Approve user
app.post('/api/admin/users/:id/approve', (req, res) => {
  const { id } = req.params;
  const { adminName } = req.body;
  const users = readJson<User[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ message: '해당 사용자를 찾을 수 없습니다.' });
  }

  user.status = 'approved';
  user.approvedAt = new Date().toISOString();
  writeJson(USERS_FILE, users);

  recordAudit({
    userId: user.id,
    username: user.username,
    name: user.name,
    department: user.department,
    action: 'USER_APPROVED',
    category: 'ADMIN',
    details: `관리자 [${adminName || '시스템관리자'}]가 [${user.name}(${user.username})] 계정을 승인함`,
  });

  return res.json({ success: true, message: `${user.name} 님의 계정이 승인되었습니다.` });
});

// Ban user
app.post('/api/admin/users/:id/ban', (req, res) => {
  const { id } = req.params;
  const { adminName, reason } = req.body;
  const users = readJson<User[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ message: '해당 사용자를 찾을 수 없습니다.' });
  }

  if (user.role === 'admin' || user.username === '시스템관리자') {
    return res.status(400).json({ message: '최고관리자 계정은 벤(차단)할 수 없습니다.' });
  }

  user.status = 'banned';
  user.bannedAt = new Date().toISOString();
  writeJson(USERS_FILE, users);

  recordAudit({
    userId: user.id,
    username: user.username,
    name: user.name,
    department: user.department,
    action: 'USER_BANNED',
    category: 'ADMIN',
    details: `관리자 [${adminName || '시스템관리자'}]가 [${user.name}(${user.username})] 계정을 차단(벤)함 ${reason ? `(사유: ${reason})` : ''}`,
  });

  return res.json({ success: true, message: `${user.name} 님의 계정이 차단(벤) 처리되었습니다.` });
});

// Unban user
app.post('/api/admin/users/:id/unban', (req, res) => {
  const { id } = req.params;
  const { adminName } = req.body;
  const users = readJson<User[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ message: '해당 사용자를 찾을 수 없습니다.' });
  }

  user.status = 'approved';
  delete user.bannedAt;
  writeJson(USERS_FILE, users);

  recordAudit({
    userId: user.id,
    username: user.username,
    name: user.name,
    department: user.department,
    action: 'USER_UNBANNED',
    category: 'ADMIN',
    details: `관리자 [${adminName || '시스템관리자'}]가 [${user.name}(${user.username})] 계정 차단을 해제함`,
  });

  return res.json({ success: true, message: `${user.name} 님의 차단이 해제되었습니다.` });
});

// Delete user
app.delete('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;
  const { adminName } = req.body;
  let users = readJson<User[]>(USERS_FILE, []);
  const target = users.find((u) => u.id === id);

  if (!target) {
    return res.status(404).json({ message: '해당 사용자를 찾을 수 없습니다.' });
  }

  if (target.role === 'admin' || target.username === '시스템관리자') {
    return res.status(400).json({ message: '최고관리자 계정은 삭제할 수 없습니다.' });
  }

  users = users.filter((u) => u.id !== id);
  writeJson(USERS_FILE, users);

  recordAudit({
    userId: target.id,
    username: target.username,
    name: target.name,
    department: target.department,
    action: 'USER_DELETED',
    category: 'ADMIN',
    details: `관리자 [${adminName || '시스템관리자'}]가 [${target.name}(${target.username})] 계정을 영구 삭제함`,
  });

  return res.json({ success: true, message: '사용자가 삭제되었습니다.' });
});

// Get Audit Logs (Admin only)
app.get('/api/admin/audit-logs', (req, res) => {
  const logs = readJson<AuditLog[]>(AUDIT_FILE, []);
  return res.json({ logs });
});

// Clear Audit Logs (Optional)
app.delete('/api/admin/audit-logs', (req, res) => {
  const { adminName } = req.body;
  const resetLog: AuditLog = {
    id: `log-${Date.now()}`,
    userId: 'admin',
    username: '시스템관리자',
    name: adminName || '시스템관리자',
    department: '전산기획실',
    action: 'LOGS_CLEARED',
    category: 'ADMIN',
    details: '관리자가 이전 활동 감사 기록을 초기화함',
    timestamp: new Date().toISOString(),
  };
  writeJson(AUDIT_FILE, [resetLog]);
  return res.json({ success: true, message: '활동 기록이 초기화되었습니다.' });
});

// --- 3. DOCUMENT FORMS (양식함) ---

// Get all forms (with live Firestore fetch to ensure multi-instance consistency on Vercel)
app.get('/api/forms', async (req, res) => {
  let forms = readJson<DocForm[]>(FORMS_FILE, []);
  if (firestoreDb) {
    try {
      const formSnap = await firestoreDb.collection('forms').doc('all_data').get();
      if (formSnap.exists) {
        const cloudItems = formSnap.data()?.items;
        if (Array.isArray(cloudItems)) {
          const deletedIds = readJson<string[]>(DELETED_FORMS_FILE, []);
          const formMap = new Map<string, DocForm>();
          [...forms, ...cloudItems].forEach((f) => {
            if (f && f.id && !deletedIds.includes(f.id)) {
              formMap.set(f.id, f);
            }
          });
          forms = Array.from(formMap.values());
          ensureDirs();
          fs.writeFileSync(FORMS_FILE, JSON.stringify(forms, null, 2), 'utf-8');
        }
      }
    } catch (e) {
      console.warn('Live Firestore forms fetch warning:', e);
    }
  }
  return res.json({ forms });
});

// Upload new form (Admin or staff)
app.post('/api/forms', uploadForm.single('file'), async (req, res) => {
  const { title, category, department, description, uploaderName, uploaderId } = req.body;
  const file = req.file;

  if (!title || !category) {
    return res.status(400).json({ message: '양식 명칭과 카테고리를 입력해주세요.' });
  }

  const forms = readJson<DocForm[]>(FORMS_FILE, []);
  let storedFileName = '';
  let fileExt = 'hwp';
  let fileSize = 10240;

  if (file) {
    storedFileName = file.filename;
    fileExt = path.extname(file.originalname).replace('.', '').toLowerCase() || 'hwp';
    fileSize = file.size;
  } else {
    // Generate an automatic default HWP file if uploaded as template metadata
    const generatedName = `${Date.now()}_${encodeURIComponent(title)}.hwp`;
    const diskPath = path.join(FORMS_DIR, generatedName);
    const mockHwpContent = Buffer.from(
      `HWP Document File V5.00\r\n\r\n【${title}】\n부서: ${department || '공통'}\n작성일: ${new Date().toLocaleDateString('ko-KR')}\n\n[내용 및 양식 규격]\n${description || '기관 표준 양식 내용'}`
    );
    fs.writeFileSync(diskPath, mockHwpContent);
    storedFileName = generatedName;
  }

  const newForm: DocForm = {
    id: `form-${Date.now()}`,
    title: String(title).trim(),
    category: String(category).trim(),
    department: department ? String(department).trim() : '공통',
    description: description ? String(description).trim() : '',
    fileName: file ? file.originalname : `${title}.${fileExt}`,
    fileExt: fileExt,
    filePath: storedFileName,
    fileSize: fileSize,
    uploadedBy: uploaderId || 'admin-master',
    uploaderName: uploaderName || '시스템관리자',
    createdAt: new Date().toISOString(),
    downloadCount: 0,
    isOfficial: true,
  };

  forms.unshift(newForm);
  await writeJson(FORMS_FILE, forms);

  await recordAudit({
    userId: uploaderId || 'admin-master',
    username: uploaderName || '시스템관리자',
    name: uploaderName || '시스템관리자',
    department: department || '전산기획실',
    action: 'FORM_UPLOAD',
    category: 'FORM',
    details: `신규 서식 등록 완료: [${newForm.title}] (${newForm.fileName})`,
  });

  return res.json({ success: true, form: newForm });
});

// Download form file
app.get('/api/forms/:id/download', async (req, res) => {
  const { id } = req.params;
  const { userId, userName, userDept } = req.query;
  const forms = readJson<DocForm[]>(FORMS_FILE, []);
  const form = forms.find((f) => f.id === id);

  if (!form) {
    return res.status(404).json({ message: '해당 양식을 찾을 수 없습니다.' });
  }

  // Increment download count
  form.downloadCount = (form.downloadCount || 0) + 1;
  await writeJson(FORMS_FILE, forms);

  // Record audit
  await recordAudit({
    userId: String(userId || 'guest'),
    username: String(userName || '익명'),
    name: String(userName || '익명사용자'),
    department: String(userDept || '기관부서'),
    action: 'FORM_DOWNLOAD',
    category: 'FORM',
    details: `서식 다운로드: [${form.title}] (${form.fileName})`,
  });

  const filePath = path.join(FORMS_DIR, form.filePath);
  if (fs.existsSync(filePath)) {
    return res.download(filePath, form.fileName);
  }

  // If physical file was missing, create valid HWP payload on the fly
  const content = `HWP Document File V5.00\r\n\r\n【${form.title}】\n\n${form.description || '기관 표준 양식'}`;
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(form.fileName)}"`);
  res.setHeader('Content-Type', 'application/x-hwp');
  return res.send(Buffer.from(content, 'utf-8'));
});

// Delete form
app.delete('/api/forms/:id', async (req, res) => {
  const { id } = req.params;
  const { adminName } = req.body;
  let forms = readJson<DocForm[]>(FORMS_FILE, []);
  const form = forms.find((f) => f.id === id);

  if (!form) {
    return res.status(404).json({ message: '해당 양식을 찾을 수 없습니다.' });
  }

  // Remove file from disk if exists
  try {
    const filePath = path.join(FORMS_DIR, form.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Error removing form file:', err);
  }

  forms = forms.filter((f) => f.id !== id);
  await writeJson(FORMS_FILE, forms);

  // Track in deleted forms list so it never reappears
  const deletedIds = readJson<string[]>(DELETED_FORMS_FILE, []);
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    await writeJson(DELETED_FORMS_FILE, deletedIds);
  }

  await recordAudit({
    userId: 'admin',
    username: adminName || '시스템관리자',
    name: adminName || '시스템관리자',
    department: '전산기획실',
    action: 'FORM_DELETE',
    category: 'FORM',
    details: `서식 삭제 완료: [${form.title}] (${form.fileName})`,
  });

  return res.json({ success: true, message: '양식이 삭제되었습니다.' });
});

// --- 4. BOARD (전체 게시판) ---

// Get all posts
app.get('/api/posts', (req, res) => {
  const posts = readJson<Post[]>(POSTS_FILE, []);
  return res.json({ posts });
});

// Create post
app.post('/api/posts', (req, res) => {
  const { title, category, content, authorId, authorName, department, isNotice } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: '제목과 내용을 입력해주세요.' });
  }

  const posts = readJson<Post[]>(POSTS_FILE, []);
  const newPost: Post = {
    id: `post-${Date.now()}`,
    title: String(title).trim(),
    category: category || '일반업무',
    content: String(content).trim(),
    authorId: authorId || 'user',
    authorName: authorName || '직원',
    department: department || '기관부서',
    createdAt: new Date().toISOString(),
    views: 0,
    isNotice: !!isNotice,
    comments: [],
  };

  posts.unshift(newPost);
  writeJson(POSTS_FILE, posts);

  recordAudit({
    userId: newPost.authorId,
    username: newPost.authorName,
    name: newPost.authorName,
    department: newPost.department,
    action: 'POST_CREATE',
    category: 'BOARD',
    details: `게시글 등록: [${newPost.title}] (${newPost.category})`,
  });

  return res.json({ success: true, post: newPost });
});

// Increment post view & get detail
app.get('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const posts = readJson<Post[]>(POSTS_FILE, []);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
  }

  post.views = (post.views || 0) + 1;
  writeJson(POSTS_FILE, posts);
  return res.json({ post });
});

// Add comment to post
app.post('/api/posts/:id/comments', (req, res) => {
  const { id } = req.params;
  const { authorId, authorName, department, content } = req.body;
  if (!content) {
    return res.status(400).json({ message: '댓글 내용을 입력해주세요.' });
  }

  const posts = readJson<Post[]>(POSTS_FILE, []);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
  }

  const newComment: PostComment = {
    id: `comm-${Date.now()}`,
    authorId: authorId || 'user',
    authorName: authorName || '직원',
    department: department || '기관부서',
    content: String(content).trim(),
    createdAt: new Date().toISOString(),
  };

  post.comments = post.comments || [];
  post.comments.push(newComment);
  writeJson(POSTS_FILE, posts);

  recordAudit({
    userId: newComment.authorId,
    username: newComment.authorName,
    name: newComment.authorName,
    department: newComment.department,
    action: 'COMMENT_CREATE',
    category: 'BOARD',
    details: `게시글 [${post.title}]에 댓글 등록`,
  });

  return res.json({ success: true, comment: newComment });
});

// Delete post
app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const { adminName, userId } = req.body;
  let posts = readJson<Post[]>(POSTS_FILE, []);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
  }

  posts = posts.filter((p) => p.id !== id);
  writeJson(POSTS_FILE, posts);

  recordAudit({
    userId: userId || 'admin',
    username: adminName || '관리자',
    name: adminName || '관리자',
    department: '기관',
    action: 'POST_DELETE',
    category: 'BOARD',
    details: `게시글 삭제: [${post.title}]`,
  });

  return res.json({ success: true, message: '게시글이 삭제되었습니다.' });
});

// Like / Upvote post
app.post('/api/posts/:id/like', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const posts = readJson<Post[]>(POSTS_FILE, []);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
  }

  post.likedBy = post.likedBy || [];
  const uId = userId || 'anonymous';
  const hasLiked = post.likedBy.includes(uId);

  if (hasLiked) {
    post.likedBy = post.likedBy.filter((uid) => uid !== uId);
    post.likes = Math.max(0, (post.likes || 1) - 1);
  } else {
    post.likedBy.push(uId);
    post.likes = (post.likes || 0) + 1;
  }

  writeJson(POSTS_FILE, posts);
  return res.json({ success: true, likes: post.likes, hasLiked: !hasLiked });
});

// Update post status (Admin only or author)
app.patch('/api/posts/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, adminName } = req.body;
  const posts = readJson<Post[]>(POSTS_FILE, []);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
  }

  post.status = status;
  writeJson(POSTS_FILE, posts);

  recordAudit({
    userId: 'admin',
    username: adminName || '시스템관리자',
    name: adminName || '시스템관리자',
    department: '전산기획실',
    action: 'POST_STATUS_CHANGE',
    category: 'BOARD',
    details: `건의사항 [${post.title}] 상태를 [${status}]로 변경`,
  });

  return res.json({ success: true, post });
});

// --- 5. LOG AUDIT FROM CLIENT (PDF operations, Background removals) ---
app.post('/api/audit-logs', (req, res) => {
  const { userId, username, name, department, action, category, details } = req.body;
  if (!action || !details) {
    return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
  }

  recordAudit({
    userId: userId || 'guest',
    username: username || 'guest',
    name: name || '직원',
    department: department || '기관',
    action: String(action),
    category: (category as any) || 'PDF',
    details: String(details),
  });

  return res.json({ success: true });
});

// --- 6. DECRYPTION (PDF & XLSX) ---
app.post('/api/decrypt', multer().single('file'), async (req, res) => {
  const { password } = req.body;
  const file = req.file;

  if (!file || !password) {
    return res.status(400).json({ message: '파일과 비밀번호가 필요합니다.' });
  }

  try {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ext === '.pdf') {
      const { PDFDocument } = await import('pdf-lib');
      console.log('Attempting to load PDF with password length:', password ? password.length : 0);
      try {
        const pdfDoc = await PDFDocument.load(file.buffer, { password: password });
        const decryptedBytes = await pdfDoc.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="decrypted_${file.originalname}"`);
        return res.send(Buffer.from(decryptedBytes));
      } catch (pdfErr) {
        console.error('pdf-lib loading error:', pdfErr);
        throw pdfErr;
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const XLSX = await import('xlsx');
      // For Excel, we read with password
      const workbook = XLSX.read(file.buffer, { type: 'buffer', password: password });
      const decryptedBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="decrypted_${file.originalname}"`);
      return res.send(decryptedBuffer);
    } else {
      return res.status(400).json({ message: '지원되지 않는 파일 형식입니다.' });
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return res.status(401).json({ message: '암호 해제 실패: 비밀번호가 틀렸거나 지원되지 않는 암호화 방식입니다.' });
  }
});

// --- Vite Middleware or Static Servings ---
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Smart DocWork Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;
