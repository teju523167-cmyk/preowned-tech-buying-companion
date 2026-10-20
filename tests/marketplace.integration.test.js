import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { unlink } from "node:fs/promises";

let mongod, app, buyer, sellerA, sellerB, moderator, buyerToken, sellerAToken, moderatorToken, listingA, listingB, User;
async function registerAndLogin(email, role, name) {
  const client=request.agent(app);
  const registered=await client.post("/api/auth/register").send({name,email,password:"Capstone-Pass-123",role});
  expect(registered.status).toBe(201);
  const inbox=await client.get(`/api/dev-email-inbox?email=${encodeURIComponent(email)}`);
  const token=inbox.body.messages[0].text.match(/\{"token":"([a-f0-9]+)"\}/)?.[1];
  expect(token).toBeTruthy();
  expect((await client.post("/api/auth/verify-email").send({token})).status).toBe(200);
  const login=await client.post("/api/auth/login").send({email,password:"Capstone-Pass-123"});
  expect(login.status).toBe(200);
  const csrf=(await client.get("/api/auth/csrf-token")).body.csrfToken;
  return { client, csrf, id:login.body.user.id };
}
const listingBody=(title)=>({title,description:`${title} in good working condition.`,brand:"DemoTech",category:"laptop",condition:"good",price:42000,specifications:{modelName:"Demo 14",processor:"Core i5",memoryGB:16,storageGB:512}});

beforeAll(async()=>{
  mongod=await MongoMemoryServer.create();
  process.env.NODE_ENV="test";process.env.MONGODB_URI=mongod.getUri();process.env.SESSION_SECRET="test-session-secret-12345678901234567890";process.env.FRONTEND_ORIGIN="http://localhost:5173";
  app=(await import("../src/app.js")).default;
  await mongoose.connect(process.env.MONGODB_URI);
  User=(await import("../src/models/User.js")).default;
  await User.create({name:"Test Mod",email:"mod@example.test",password:await bcrypt.hash("Capstone-Pass-123",10),role:"moderator",isEmailVerified:true});
  moderator=request.agent(app);await moderator.post("/api/auth/login").send({email:"mod@example.test",password:"Capstone-Pass-123"});moderatorToken=(await moderator.get("/api/auth/csrf-token")).body.csrfToken;
  buyer=await registerAndLogin("buyer@example.test","buyer","Buyer One");buyerToken=buyer.csrf;
  sellerA=await registerAndLogin("seller-a@example.test","seller","Seller A");sellerAToken=sellerA.csrf;
  sellerB=await registerAndLogin("seller-b@example.test","seller","Seller B");
},120000);
afterAll(async()=>{try{const Evidence=(await import("../src/models/listingEvidence.js")).default;const rows=await Evidence.find().select("+storagePath");for(const row of rows)if(row.storagePath)await unlink(row.storagePath).catch(()=>{});}catch{}await mongoose.disconnect();await mongod?.stop();});

describe("MongoDB-backed marketplace workflows",()=>{
  it("enforces email verification, CSRF, session rotation and single-use password reset",async()=>{
    const email="security-check@example.test",client=request.agent(app);
    const firstCsrf=await client.get("/api/auth/csrf-token");
    const firstSid=firstCsrf.headers["set-cookie"]?.find(c=>c.startsWith("preowned.sid="))?.split(";")[0];
    expect((await client.post("/api/auth/register").send({name:"Security Check",email,password:"Capstone-Pass-123",role:"buyer"})).status).toBe(201);
    expect((await client.post("/api/auth/login").send({email,password:"Capstone-Pass-123"})).status).toBe(403);
    const verifyInbox=(await client.get(`/api/dev-email-inbox?email=${email}`)).body.messages[0].text;
    const verifyToken=verifyInbox.match(/\{"token":"([a-f0-9]+)"\}/)?.[1];
    expect((await client.post("/api/auth/verify-email").send({token:verifyToken})).status).toBe(200);
    expect((await client.post("/api/auth/verify-email").send({token:verifyToken})).status).toBe(400);
    const logged=await client.post("/api/auth/login").send({email,password:"Capstone-Pass-123"});
    expect(logged.status).toBe(200);
    const rotatedSid=logged.headers["set-cookie"]?.find(c=>c.startsWith("preowned.sid="))?.split(";")[0];
    expect(rotatedSid).toBeTruthy();if(firstSid)expect(rotatedSid).not.toBe(firstSid);
    expect((await client.post("/api/preferences").send({useCase:"coding"})).status).toBe(403);
    const secondSession=request.agent(app);await secondSession.post("/api/auth/login").send({email,password:"Capstone-Pass-123"});
    await client.post("/api/auth/forgot-password").send({email});
    const resetMessage=(await client.get(`/api/dev-email-inbox?email=${email}`)).body.messages[0].text;
    const resetToken=resetMessage.match(/\{"token":"([a-f0-9]+)"\}/)?.[1];
    expect((await client.post("/api/auth/reset-password").send({token:resetToken,password:"Replacement-Pass-321"})).status).toBe(200);
    expect((await client.post("/api/auth/reset-password").send({token:resetToken,password:"Again-Pass-432"})).status).toBe(400);
    expect((await secondSession.get("/api/auth/me")).status).toBe(401);
    expect((await client.post("/api/auth/login").send({email,password:"Replacement-Pass-321"})).status).toBe(200);
  },120000);

  it("verifies email, rejects privileged signup, enforces ownership and private conversation access",async()=>{
    const privileged=await request(app).post("/api/auth/register").send({name:"Bad Role",email:"badrole@example.test",password:"Capstone-Pass-123",role:"moderator"});
    expect(privileged.status).toBe(400);
    expect((await buyer.client.post("/api/ai/discovery").set("X-CSRF-Token",buyerToken).send({query:"x"})).status).toBe(400);
    expect((await sellerA.client.post("/api/ai/discovery").set("X-CSRF-Token",sellerAToken).send({query:"Find me a laptop for programming"})).status).toBe(403);
    expect((await buyer.client.post("/api/comparison-agent").set("X-CSRF-Token",buyerToken).send({needs:"Compare laptops for college",budget:-1})).status).toBe(400);
    const duplicate=await buyer.client.post("/api/auth/register").send({name:"Duplicate",email:"buyer@example.test",password:"Capstone-Pass-123",role:"buyer"});
    expect(duplicate.status).toBe(409);

    let response=await sellerA.client.post("/api/listings").set("X-CSRF-Token",sellerAToken).send(listingBody("Seller A laptop"));
    expect(response.status).toBe(201);listingA=response.body.listing._id;
    response=await sellerB.client.post("/api/listings").set("X-CSRF-Token",sellerB.csrf).send(listingBody("Seller B laptop"));
    expect(response.status).toBe(201);listingB=response.body.listing._id;
    expect((await sellerB.client.patch(`/api/listings/${listingA}`).set("X-CSRF-Token",sellerB.csrf).send({title:"Hijacked"})).status).toBe(404);
    expect((await request(app).get("/api/listings")).body.total).toBe(0);

    response=await moderator.post(`/api/listings/${listingA}/moderation`).set("X-CSRF-Token",moderatorToken).send({action:"approved",reason:"Test approval"});
    expect(response.status).toBe(200);
    expect((await request(app).get("/api/listings")).body.total).toBe(1);
    const {embeddings}=await import("../src/ai/ollama.js");
    const down=vi.spyOn(embeddings,"embedQuery").mockRejectedValueOnce(new Error("Ollama unavailable"));
    const failedDiscovery=await buyer.client.post("/api/ai/discovery").set("X-CSRF-Token",buyerToken).send({query:"Laptop for Python under 50000"});
    expect(failedDiscovery.status).toBe(503);down.mockRestore();
    const ragDown=vi.spyOn(embeddings,"embedQuery").mockRejectedValueOnce(new Error("Ollama unavailable"));
    expect((await buyer.client.post("/api/ai/specifications").set("X-CSRF-Token",buyerToken).send({listingId:listingA,question:"Can this laptop support more RAM?"})).status).toBe(503);ragDown.mockRestore();
    const agentDown=vi.spyOn(embeddings,"embedQuery").mockRejectedValueOnce(new Error("Ollama unavailable"));
    expect((await buyer.client.post("/api/comparison-agent").set("X-CSRF-Token",buyerToken).send({needs:"Compare coding laptops under 50000",budget:50000})).status).toBe(503);agentDown.mockRestore();
    response=await buyer.client.post("/api/buyer-chat").set("X-CSRF-Token",buyerToken).send({listingId:listingA,message:"Is the battery healthy?"});
    expect(response.status).toBe(201);
    const outsider=await registerAndLogin("buyer-two@example.test","buyer","Buyer Two");
    const forbidden=await outsider.client.get(`/api/buyer-chat?listingId=${listingA}&otherUserId=${sellerA.id}`);
    expect(forbidden.status).toBe(403);
    expect((await outsider.client.post("/api/buyer-chat").set("X-CSRF-Token",outsider.csrf).send({listingId:listingA,message:"Hi"})).status).toBe(201);
    const messages=await buyer.client.get(`/api/buyer-chat?listingId=${listingA}&otherUserId=${sellerA.id}`);
    expect(messages.status).toBe(200);expect(messages.body.messages).toHaveLength(1);

    await moderator.post(`/api/listings/${listingA}/moderation`).set("X-CSRF-Token",moderatorToken).send({action:"flagged",reason:"Test suspension"});
    const suspendedViewing=await buyer.client.post(`/api/listings/${listingA}/viewings`).set("X-CSRF-Token",buyerToken).send({proposedDate:new Date(Date.now()+86400000).toISOString()});
    expect(suspendedViewing.status).toBe(404);
    expect((await sellerB.client.get("/api/auth/me")).status).toBe(200);
  },120000);

  it("runs shortlist, seller question/viewing response, private evidence, and report review workflows",async()=>{
    const approve=await moderator.post(`/api/listings/${listingB}/moderation`).set("X-CSRF-Token",moderatorToken).send({action:"approved",reason:"Approved test listing"});
    expect(approve.status).toBe(200);
    expect((await buyer.client.post("/api/shortlists").set("X-CSRF-Token",buyerToken).send({listingId:listingB})).status).toBe(200);
    expect((await buyer.client.get("/api/shortlists")).body.count).toBe(1);
    const question=(await buyer.client.post(`/api/listings/${listingB}/questions`).set("X-CSRF-Token",buyerToken).send({question:"Has the battery been replaced?"}));
    expect(question.status).toBe(201);
    const received=(await sellerB.client.get("/api/questions/received")).body.questions[0];
    expect(received._id).toBe(question.body.question._id);
    expect((await sellerB.client.patch(`/api/questions/${received._id}/answer`).set("X-CSRF-Token",sellerB.csrf).send({answer:"The seller has not replaced it."})).status).toBe(200);
    const when=new Date(Date.now()+86400000).toISOString();
    const viewing=await buyer.client.post(`/api/listings/${listingB}/viewings`).set("X-CSRF-Token",buyerToken).send({proposedDate:when});
    expect(viewing.status).toBe(201);
    expect((await sellerB.client.patch(`/api/viewings/${viewing.body.viewing._id}/status`).set("X-CSRF-Token",sellerB.csrf).send({status:"accepted"})).status).toBe(200);

    const pdf=Buffer.from("%PDF-1.4\ncapstone private evidence\n%%EOF");
    const uploaded=await sellerB.client.post(`/api/listings/${listingB}/evidence/file`).set("X-CSRF-Token",sellerB.csrf).set("Content-Type","application/pdf").set("x-evidence-type","proof_of_ownership").set("x-file-name","private-proof.pdf").send(pdf);
    expect(uploaded.status).toBe(201);
    const evidenceId=uploaded.body.evidence.id;
    expect((await sellerA.client.get(`/api/listings/${listingB}/evidence/${evidenceId}/file`)).status).toBe(404);
    expect((await moderator.get(`/api/moderator/evidence/${evidenceId}/file`)).status).toBe(200);
    const pub=(await request(app).get(`/api/listings/${listingB}`)).body.listing;
    expect(pub.conditionDisclosure).not.toHaveProperty("ownershipConfirmed");
    expect(JSON.stringify(pub)).not.toContain("private-proof.pdf");
    expect((await moderator.patch(`/api/moderator/evidence/${evidenceId}`).set("X-CSRF-Token",moderatorToken).send({decision:"accepted",reason:"Document reviewed"})).status).toBe(200);

    const report=await buyer.client.post(`/api/listings/${listingB}/reports`).set("X-CSRF-Token",buyerToken).send({reason:"The product description seems inconsistent."});
    expect(report.status).toBe(201);
    const reports=(await moderator.get("/api/moderator/reports?status=pending")).body.reports;
    expect(reports.some(item=>String(item._id)===String(report.body.report.id))).toBe(true);
    expect((await moderator.patch(`/api/moderator/reports/${report.body.report.id}`).set("X-CSRF-Token",moderatorToken).send({decision:"reviewed",note:"Checked against seller response"})).status).toBe(200);
  },120000);
});
