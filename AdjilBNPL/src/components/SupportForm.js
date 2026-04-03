// Simple support form component (headless): call createSupportTicket
import { createSupportTicket } from '../services/mailService.js';

export function mountSupportForm(containerId = 'support-form') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `
    <div class="space-y-3">
      <input id="sup-email" type="email" placeholder="بريدك الإلكتروني" class="w-full bg-slate-800 text-white p-3 rounded-xl" />
      <input id="sup-subject" type="text" placeholder="الموضوع" class="w-full bg-slate-800 text-white p-3 rounded-xl" />
      <textarea id="sup-desc" placeholder="اشرح مشكلتك بإيجاز" class="w-full bg-slate-800 text-white p-3 rounded-xl h-24"></textarea>
      <button id="sup-send" class="bg-primary text-white font-bold py-3 rounded-xl">إرسال</button>
      <div id="sup-status" class="text-xs text-slate-400"></div>
    </div>
  `;
  const email = container.querySelector('#sup-email');
  const subject = container.querySelector('#sup-subject');
  const desc = container.querySelector('#sup-desc');
  const btn = container.querySelector('#sup-send');
  const status = container.querySelector('#sup-status');
  btn.onclick = async () => {
    btn.disabled = true;
    status.textContent = '... يتم الإرسال';
    const res = await createSupportTicket({ userEmail: email.value, subject: subject.value, description: desc.value });
    if (res.ok) {
      status.textContent = 'تم إنشاء التذكرة وإرسال إشعار البريد';
    } else if (res.offline) {
      status.textContent = 'لا يوجد اتصال بالسحابة، تم حفظ التذكرة محلياً وسيتم معالجتها لاحقاً';
    } else {
      status.textContent = 'حدث خطأ في الإرسال، تم حفظ التذكرة محلياً';
    }
    btn.disabled = false;
  };
}

