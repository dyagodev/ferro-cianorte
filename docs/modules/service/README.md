# Nexus ERP — Service Module

Version: 1.0

Status: Planning

---

# Overview

The Service Module is responsible for managing every type of service operation inside Nexus ERP.

Unlike traditional ERPs that create separate modules for workshops, clinics, pet shops or beauty salons, Nexus Services is designed as a configurable service engine.

The same module must support:

- Mechanical workshops
- Auto repair shops
- Technical assistance
- Pet Shops
- Veterinary Clinics
- Medical Clinics
- Dental Clinics
- Beauty Salons
- Barbershops
- Massage Centers
- Physiotherapy
- Consulting Companies
- Maintenance Companies
- Field Services
- Cleaning Companies
- Schools
- Gyms
- Any business that sells services.

Instead of hardcoding business rules for each market, the module is based on configurable entities.

---

# Main Concepts

The Service Module is built around six core concepts.

Customer

↓

Asset

↓

Appointment

↓

Service Order

↓

Execution

↓

Financial Settlement

Everything revolves around those concepts.

---

# Design Principles

The module must follow these principles.

## Generic

No entity should be specific to a business.

Avoid classes like:

Pet

Vehicle

Patient

Equipment

Instead use generic entities.

Asset

AssetType

CustomFields

Templates

Workflow

ServiceOrder

---

## Extensible

Every company must be able to customize:

Fields

Forms

Workflow

Stages

Terminology

Permissions

Notifications

Documents

without changing source code.

---

## Modular

The module must integrate with:

CRM

Inventory

Financial

Fiscal

Reports

Calendar

Notifications

WhatsApp

Electronic Invoice

without direct coupling.

---

# Architecture

The Service Module is divided into submodules.

Customer Management

↓

Asset Management

↓

Appointment Engine

↓

Workflow Engine

↓

Forms Engine

↓

Checklist Engine

↓

Budget Engine

↓

Service Orders

↓

Financial Integration

↓

Reporting

Every submodule must have isolated Services, Repositories and Policies.

---

# Domain Language

Internally the ERP always uses technical names.

Customer

Asset

Appointment

ServiceOrder

Workflow

Resource

Professional

Service

Attachment

Estimate

Invoice

The UI may rename these entities.

Example

Workshop

Asset

↓

Vehicle

Pet Shop

Asset

↓

Pet

Clinic

Asset

↓

Patient

School

Asset

↓

Student

This translation must happen only in the frontend.

Never rename backend entities.

---

# Core Entity

The Service Order is the heart of the module.

Everything starts or ends inside a Service Order.

Appointments generate Service Orders.

Products are consumed inside Service Orders.

Professionals work inside Service Orders.

Attachments belong to Service Orders.

Checklists belong to Service Orders.

Forms belong to Service Orders.

Invoices originate from Service Orders.

Payments originate from Service Orders.

---

# Goals

The module must allow:

Schedule services

Execute services

Track execution

Manage professionals

Allocate resources

Register materials

Generate estimates

Receive approvals

Generate invoices

Receive payments

Generate reports

Everything must be configurable.

---

# Non Goals

Do not implement business rules specific to any market.

Never assume:

every workshop has vehicles

every clinic has patients

every pet shop has pets

every school has students

Those are UI aliases only.

---

# Coding Standards

No Fat Controllers

No Business Rules inside Models

No Repository returning Arrays

Use DTOs

Use Actions

Use Domain Events

Small Services

100% Policy Authorization

Feature Tests

Unit Tests

---

# Folder Structure

app

Modules

Service

Actions

DTO

Events

Listeners

Policies

Repositories

Models

Services

Jobs

Observers

Enums

Http

Requests

Controllers

Resources

---

# Final Objective

Build a generic Service Engine capable of replacing specialized software while remaining simple enough for small businesses.

Every market-specific behavior should come from configuration, never from source code.
