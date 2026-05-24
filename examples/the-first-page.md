---
title: The First Page — Incident Response Under Pressure
duration: 20min
passing_score: 75
language: en
---

## Slide: This is not the runbook

[Narration] This module is not the runbook. The runbook lives in your wiki and is — hopefully — current.

This module is about the seven minutes between the page firing and you opening the runbook, when you have to decide what kind of incident you're in, what you're going to do first, and who you are going to bring into the room.

We'll walk through three pages — one obvious, one ambiguous, one a false positive that doesn't look like one. There are right and wrong answers. There are also right answers that would have been wrong on a different day, and we'll talk about those.

## Slide: The shape of a page

[Narration] A page interrupts something. If it interrupts your sleep, you have a roughly thirty-second window in which your judgment is, charitably, not at its best.

The goal of the first minute is not to fix anything. The goal of the first minute is to make sure you are oriented before you start making decisions that compound.

Three checks, in order:

- **What service.** Read the alert carefully. Not the title. The body.
- **What signal.** Latency? Error rate? Saturation? Probe failure?
- **What scope.** One region? All regions? One customer? Everyone?

If you cannot answer those three questions in 60 seconds, you do not yet know enough to act. Acknowledge the page, set a 5-minute reminder for yourself, and go read.

## Slide: Page one — the obvious one

[Narration] 2:47 a.m. Your phone goes off.

```
[CRITICAL] payments-api: error rate 100% for 2 minutes (p2)
region: eu-west-1
service-owner: payments-team (you)
```

You sit up. The error rate is 100%. The region is your largest customer base. The service is, ah, payments.

## Branch: First move?

[Prompt] You have just acknowledged the page. What is the first action you take?
[Option: Open the runbook → page1-runbook]
[Option: Check the deploy log for the last hour → page1-deploy]
[Option: Page a second responder before you do anything else → page1-second]

## Slide: You open the runbook
[Id] page1-runbook

[Narration] Defensible. Usually the right move. Today, maybe the wrong one.

The runbook is the right move when you don't know what's broken. At 100% error rate on a service you own, you have a strong prior on what the page means: something just changed. The runbook will get you to the dashboard, the dashboard will tell you what you already strongly suspect, and you'll be three minutes further into the incident before you check the deploy log.

If the runbook is what you reach for at 100% error rate, that's fine — you will land in the right place. But notice that what you actually wanted was the deploy log, and you could have opened it in parallel.

The expensive version of this mistake is when the runbook is out of date and you spend ten minutes following stale instructions before you start trusting your own read of the situation. New responders especially: the runbook is a tool, not an oracle.

## Slide: You check the deploy log
[Id] page1-deploy

[Narration] Right move at 2:47 a.m. when error rate is 100%.

The deploy log will tell you, in under thirty seconds, whether someone shipped to this service in the last hour. If they did, you have a strong candidate for the root cause and a strong candidate for the fix: revert.

You will check the deploy log. You will see a deploy at 2:31. You will check the runbook section on emergency rollback. You will execute the rollback. The error rate will return to baseline within two minutes of the rollback completing. The total incident duration from page to recovery will be under fifteen minutes.

You will then do the rest of the incident work — write the timeline, file the postmortem ticket, open a thread in the team channel — knowing that the immediate fire is out.

This is the cleanest version of this page. The thing that makes it clean is that you went looking for the cheapest possible explanation first. "Someone just deployed" is the cheapest possible explanation for "everything is broken." Check that hypothesis before you check the runbook for anything else.

## Slide: You page a second responder
[Id] page1-second

[Narration] Sometimes right, often premature.

The instinct to bring in a second pair of eyes is good. The risk is that you do it before you have enough context to brief them — at which point you have two confused people instead of one, and you have woken up someone you might not need.

The clean rule of thumb: page a second responder when you would not be confident describing the incident to them in two sentences. At minute one of this page, you can describe it in two sentences. "Payments-API is at 100% error rate in eu-west-1. I am about to check whether we deployed in the last hour." That is enough orientation to act alone for the next five minutes.

If, five minutes in, you still don't know what's happening — *then* you page a second responder, with a real brief. "Payments-API at 100% error rate, no recent deploy, no obvious infrastructure event, I'm out of cheap hypotheses, can you look at it with me."

That second page is precious. You burn the goodwill of a sleeping colleague. Make sure you burn it on a real ambiguity, not on first-minute jitters.

## Slide: Page two — the ambiguous one

[Narration] 3:42 p.m. on a Wednesday. Your phone goes off.

```
[WARNING] search-api: p99 latency 1.8s for 5 minutes (p3)
region: us-east-1, ap-south-1
service-owner: search-team (you)
```

The signal: latency, not error rate. The threshold: well above your SLO but not catastrophic. The scope: two regions, not all. The page priority: P3, not P2.

Nothing has obviously broken. Customers can still use the product. Customers searching from two regions are having a slower-than-promised experience.

## Branch: What do you do?

[Prompt] You're at your desk. You can act on this immediately. Do you?
[Option: Drop what you're doing and investigate now → page2-now]
[Option: Acknowledge, finish the thing you were doing, then look in 30 minutes → page2-defer]
[Option: Skim the dashboards for two minutes, then decide → page2-skim]

## Slide: You drop everything
[Id] page2-now

[Narration] Conscientious. Possibly wasteful.

P3 alerts exist because not every degradation is an emergency. Treating a P3 as a P1 is a quiet form of incident inflation: the page fires, you drop your current work, the latency mysteriously recovers, you find nothing, and the incident never goes into the database because there is no incident to write up.

You will lose forty minutes you didn't need to. The work you abandoned will slip a day. The next time a P3 fires, you will still drop everything — because the precedent you set today was "P3 means everything stops."

The cost is invisible until it accumulates. P3 alerts deserve a different reflex than P1s, on purpose. If you don't have one yet, build one.

## Slide: You acknowledge and defer
[Id] page2-defer

[Narration] Often correct. Sometimes the trap.

The right version of this move: you acknowledge the page, write a one-line note to yourself ("p99 latency two regions, will check at 4:15"), and continue. At 4:15, you check. If the alert has cleared on its own — common — you note that and move on. If it has not, you start the investigation properly.

The trap: you defer, the alert clears, you never write up what you saw, and the next time it happens you don't recognize the pattern. P3 alerts that clear on their own are *data* — the cheapest kind, because you didn't have to do anything to collect it. Throwing that data away by not noting it is the actual cost of deferring without a tail.

If you defer, write a note. Every time.

## Slide: You skim first
[Id] page2-skim

[Narration] The best of the three.

Two minutes of dashboard time tells you what kind of latency you're dealing with. Is it everywhere or one query path? Did it spike or ramp? Did anything else move? You will know, in two minutes, whether this is something you can defer with confidence or something you actually need to dig into.

The skim is cheap. It costs you the same two minutes as you spend triaging email. It also catches the rare P3 that should have been a P2 — the kind where the alert threshold was set too high, the customer impact is real, and the auto-paging hasn't caught up. Catching one of those a quarter is worth the two minutes a week.

Three moves, in order, every time:
1. **Two-minute skim** to classify the alert
2. **Brief note** of what you saw (even one sentence)
3. **Decide**: act now, defer with reason, or close

Build this habit now and your P3 reflexes will diverge from your P1 reflexes in the right direction.

## Slide: Page three — the false positive that isn't

[Narration] 9:13 a.m. Coffee. Page fires.

```
[CRITICAL] checkout-api: synthetic probe failing in eu-central-1 (p2)
region: eu-central-1
service-owner: checkout-team (you)
```

You check the dashboard. Real-user traffic to checkout-api in eu-central-1 looks normal. Conversion is normal. Error rate is normal. Latency is normal. Only the synthetic probe — the one that runs every minute from a monitoring host — is failing.

The temptation is to call it a probe issue and close the alert.

## Branch: What do you do?

[Prompt] Synthetic probe says no, every other signal says yes. What's your move?
[Option: Mark as false positive, file a ticket to fix the probe → page3-false]
[Option: Investigate the probe failure itself before closing → page3-investigate]
[Option: Page the team that owns the probing infrastructure → page3-page]

## Slide: You close it as a false positive
[Id] page3-false

[Narration] The most common move in this scenario. Frequently a mistake.

A synthetic probe failing while everything else looks fine has three plausible explanations:

- The probe is broken. (Common.)
- The probe is the only thing observing a specific failure mode that real users haven't hit yet. (Less common but the expensive case.)
- The probe is from a network path that is degraded in a way real users aren't seeing. (Common, and a real signal about a real network event you'd otherwise miss.)

Closing as false-positive without checking which of the three you're in is closing for convenience. The third explanation is the most dangerous: a regional networking event that affects synthetic probing today and real user traffic in fifteen minutes. The page is doing its job. You are tempted to silence it because the dashboard doesn't agree yet.

If your default reflex on a synthetic-only failure is "false positive," update the reflex.

## Slide: You investigate the probe failure
[Id] page3-investigate

[Narration] Right move.

Five minutes of investigation. What does the probe actually do — what endpoint, what payload, what region is it dialing from? What's the failure mode — connection timeout, 500, 404, certificate error?

You will find one of three things:

- A configuration drift: the probe is hitting an endpoint that was deprecated last sprint. Real signal about the probe. Fix the probe, close cleanly.
- A network anomaly: the probe is timing out from a specific monitoring region. Check the network event tracker for that region. You may be the first one to notice a cloud-provider issue.
- A latent service bug: the probe payload triggers a code path that real user traffic does not yet exercise. You just found a bug before customers did. This is the case the probe exists for.

In all three cases, the work was worth five minutes. In the third case, the work was worth several thousand dollars of avoided incident.

## Slide: You page the probing team
[Id] page3-page

[Narration] Premature. The probing team owns the probe; the probe targets your service. The question of "is the probe broken" is one you can answer faster than they can — because *you* know what the endpoint should be doing.

The right time to page the probing team is after five minutes of your own investigation, when you have a specific question for them: "Probe is timing out from monitoring-host-7 starting at 09:11, but real-user traffic and other probes are fine. Can you confirm host-7 isn't itself degraded?"

That page is useful. It is also impossible to write without first doing the investigation you skipped.

## Check: What's the through-line across all three pages?

[Q] Across the three pages — payments outage, latency warning, synthetic probe failure — what is the single most important *first* action, before any specific response?
[A] Acknowledge the alert and notify stakeholders.
[A*] Read the alert body carefully and form a one-sentence description of what is actually happening.
[A] Open the runbook for the affected service.
[A] Check whether anyone else is already responding.
[Feedback correct] Right. Every other action is contingent on knowing what kind of incident you're in. A one-sentence read of the alert — service, signal, scope — is what separates "I am responding" from "I am reacting." The runbook, the dashboards, the second responder, all come after.
[Feedback incorrect] Each of the other options is sometimes the right *next* action. The thing that has to come first is the orientation — service, signal, scope — without which every other choice is essentially a guess.
[Points] 2

## Check: When should you page a second responder?

[Q] You are five minutes into an incident. You are not in immediate danger of making it worse. The right rule for paging a second responder is:
[A] As soon as the page fires — always two people, always.
[A] Only when you have failed to fix it.
[A*] When you cannot brief the second responder in two clean sentences about what is happening.
[A] When the incident has gone past 15 minutes of duration.
[Feedback correct] Right. The criterion is *orientation*, not duration. If you cannot describe the incident in two sentences, you do not yet have enough context to act alone, and a second pair of eyes is worth waking up. If you can, the second responder is mostly going to slow you down with questions you should already be answering for yourself.
[Feedback incorrect] Closer than the others, but the criterion isn't a duration or a default — it's whether you can brief the next person in two sentences. That tells you whether the incident is in a state where a second responder helps or is just noise on top.
[Points] 2

## Slide: The thing the runbook can't teach

[Narration] Runbooks teach you the moves. Pages teach you the choices.

The reason this module exists is that the gap between knowing the moves and knowing which to use when is the gap most new on-call engineers fall into in their first quarter. You will be in this gap for a while. The way out is not to memorize more — it is to develop a habit of pausing for one extra second before the first action, to ask which kind of page you are in.

The first page you take that you handle cleanly will not feel triumphant. It will feel like a non-event. That is the correct feeling. Incidents are supposed to be non-events. The work you did to make it a non-event will be invisible to everyone except your future self, who will recognize the move the next time.

## Slide: Course complete

[Narration] That's the module. The next thing you'll see on-call is a real page, and it won't look like any of the three we just covered. That's fine. The three patterns — read first, classify, brief — will still apply.

If you want to keep working on this, the best practice is to read other people's postmortems with the first-five-minutes section in mind. Not the fix. The first five minutes.
