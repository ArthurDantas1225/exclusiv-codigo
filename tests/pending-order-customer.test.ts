import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';

function loadComponent(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, (...args: any[]) => React.ReactElement<any>> = {};
  vm.runInNewContext(code, { exports, require: (name: string) => {
    if (name === 'react/jsx-runtime') return jsx;
    if (name in mocks) return mocks[name];
    throw new Error(`Unmocked import: ${name}`);
  } });
  return exports;
}
function elements(element: any): any[] {
  if (!element || typeof element !== 'object') return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(elements)];
}

test('customer registration prefills order name and returns saved ID only on success', async () => {
  let result: string | undefined = 'customer-new';
  const saved: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  const { CustomerForm } = loadComponent('customers', {
    react: React, 'next/link': 'Link', 'next/navigation': {}, 'lucide-react': {},
    './provider': { useStore: () => ({ busy: false, run: async (action: string, payload: Record<string, unknown>) => { assert.equal(action, 'customer'); payloads.push(payload); return result; } }) },
    './ui': { Form: 'Form', Field: 'Field' }, '@/lib/format': { cents: () => 0 }, '@/lib/domain': {},
  });
  const form = CustomerForm({ defaultName: 'Cliente do pedido', onSaved: (id: string) => saved.push(id) });
  assert.equal(elements(form).find(e => e.props.name === 'name').props.value, 'Cliente do pedido');
  const data = new FormData(); data.set('name', 'Nome revisado'); data.set('phone', '84996008220');
  await form.props.onSubmit(data);
  assert.deepEqual(saved, ['customer-new']);
  assert.equal(payloads[0].name, 'Nome revisado');
  assert.equal(payloads[0].phone, '84996008220');
  result = undefined;
  await form.props.onSubmit(data);
  assert.equal(saved.length, 1);
});

test('pending order can register and select a customer without creating a sale', async () => {
  const state: any[] = []; let cursor = 0; let sales = 0;
  const order = { id: 'order-1', customerName: 'Cliente do pedido', createdAt: '2026-11-13', payment: 'Pix', delivery: 'Retirada', items: [] };
  const { PendingOrders } = loadComponent('pending-orders', {
    react: { ...React, useState: (initial: unknown) => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (value: unknown) => { state[i] = value; }]; }, useEffect: () => {}, useMemo: (f: () => unknown) => f() },
    'next/link': 'Link', 'next/navigation': { useRouter: () => ({ push: () => {} }) }, 'lucide-react': {},
    './provider': { useStore: () => ({ data: { customers: [{ id: 'customer-new', name: 'Cliente do pedido' }] }, online: true, busy: false, run: () => { sales++; }, notify: () => {} }) },
    './ui': { Card: 'Card', Empty: 'Empty', Field: 'Field', Sheet: 'Sheet' },
    './customers': { CustomerForm: 'CustomerForm' }, './inter-pix-settings': { InterPixSettings: 'InterPixSettings' }, './order-notifications': { OrderNotifications: 'OrderNotifications' }, '@/lib/format': { money: String, dateTime: String }, '@/lib/pending-orders': {}, '@/lib/types': { methods: ['Pix'] }, '@/lib/domain': {},
  });
  const render = () => { cursor = 0; return elements(PendingOrders()); };
  render(); state[0] = [order];
  render().find(e => e.type === 'button' && e.props.children === 'Preencher e confirmar').props.onClick();
  render().find(e => e.type === 'button' && e.props.children === 'Cadastrar cliente').props.onClick();
  const form = render().find(e => e.type === 'CustomerForm');
  assert.equal(form.props.defaultName, order.customerName);
  assert.equal(render().find(e => e.type === 'button' && e.props.children === 'Confirmar venda').props.disabled, true);
  form.props.onSaved('customer-new');
  const tree = render();
  assert.equal(tree.some(e => e.type === 'CustomerForm'), false);
  const field = tree.find(e => e.props.name === 'customer');
  assert.equal(elements(field).find(e => e.type === 'select').props.value, 'customer-new');
  assert.equal(tree.find(e => e.type === 'button' && e.props.children === 'Confirmar venda').props.disabled, false);
  assert.equal(sales, 0);
});
