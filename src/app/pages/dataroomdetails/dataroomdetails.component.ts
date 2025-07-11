import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { DataRoomApiService } from 'src/app/core/services/DataRoomApiService.service';
import { CommonheaderComponent } from 'src/app/shared/components/commonheader/commonheader.component';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { EncryptionService } from 'src/app/core/services/encryption.service';
import { UploadDocDataRoomComponent } from '../upload-doc-data-room/upload-doc-data-room.component';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { CommonService } from 'src/app/core/services/CommonService';
import { CommonDialogService } from 'src/app/shared/components/common-dialog/common-dialog.service';
import { TranslationService } from 'src/app/core/services/TranslationService';
import { FileViewerDialogComponent } from '../file-viewer-dialog-component/file-viewer-dialog.component';

interface DataRoom {
  id: string;
  name: string;
  expires: string;
  users: number;
  files: number;
  expirationDate: any;
  userDetails?: any[];
  fileDetails?: any[];
  defaultPermissions?: any;
  storage?: any;
}

interface AuditLog {
  dataRoomName: string;
  documentName: string;
  UserName: string;
  actionName: string;
  actionBy: string;
  actionDate: string;
}

@Component({
  selector: 'app-dataroomdetails',
  templateUrl: './dataroomdetails.component.html',
  styleUrls: ['./dataroomdetails.component.scss'],
  providers: [CommonDialogService]
})
export class DataroomdetailsComponent implements OnInit {
  dataRoom: any | null = null;
  showDataRoomDetail: boolean = false;
  dataRoomTitle: string = '';
  isListView = true;
  isExpiredListView = true;
  sub$: Subscription = new Subscription();

  numCols = 3;
  rowHeight = '1:1';
  gutterSize = '10';
  listViewHeight = '70px';

  dataRooms: DataRoom[] = [];
  expiredRooms: DataRoom[] = [];
  auditLogs: AuditLog[] = [];

  dataSource = new MatTableDataSource<DataRoom>(this.dataRooms);
  expiredDataSource = new MatTableDataSource<DataRoom>(this.expiredRooms);
  auditDataSource = new MatTableDataSource<AuditLog>(this.auditLogs);

  displayedColumns: string[] = ['name', 'size', 'docType', 'permission', 'createdDate', 'actions'];
  auditDisplayedColumns: string[] = [
    'dataRoomName',
    'documentName',
    'UserName',
    'actionName',
    'actionBy',
    'actionDate',
  ];
  @ViewChild('commonHeader') commonHeader!: CommonheaderComponent;
  @ViewChild('paginatorActive') paginatorActive!: MatPaginator;
  @ViewChild('paginatorExpired') paginatorExpired!: MatPaginator;
  @ViewChild('paginatorAudit') paginatorAudit!: MatPaginator;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  selectedTabIndex = 0;

  pagedDataRooms: DataRoom[] = [];
  pageSize = 10;
  currentPage = 0;

  pagedExpiredRooms: DataRoom[] = [];
  expiredPageSize = 10;
  expiredCurrentPage = 0;

  pagedAuditLogs: AuditLog[] = [];
  auditPageSize = 10;
  auditCurrentPage = 0;

  searchExpanded: boolean = false;
  searchTerm: string = '';
  filteredDataRooms: any[] = [];
  filteredExpiredRooms: DataRoom[] = [];
  filteredAuditLogs: AuditLog[] = [];

  dataRoomPermissions: any[] = [];
  userPermissions: any[] = [];
  documentPermissions: any[] = [];

  dataRoomId: string | null = null;
  files: any[] = [];
  userPermission: string = '';
  dataRoomPermission: string = '';
  canAddDocument: boolean = false;

  // Sorting properties for matSort
  activeSort = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  auditActiveSort = 'dataRoomName';
  auditSortDirection: 'asc' | 'desc' = 'asc';

  constructor(
    private translationService: TranslationService,
    private dialog: MatDialog,
    private router: Router,
    private manageDataRoomService: DataRoomApiService,
    private toastrService: ToastrService,
    private route: ActivatedRoute
    ,
    private commonDialogService: CommonDialogService,
    private commonService: CommonService,
  ) {
    this.setCardView();
  }

  ngOnInit() {

    console.log(this.route.snapshot.paramMap.get('id'))
    this.dataRoomId = this.route.snapshot.paramMap.get('id');
    console.log('Decrypted Data Room ID:', this.dataRoomId);
    this.getAllRoomInfo();
    // this.getMockRoomInfo();

    // Set canAddDocument based on permissions

  }



  // ngOnInit(): void {
  //   this.route.paramMap.subscribe(params => {
  //     this.dataRoomId = params.get('id');
  //     this.getMockRoomInfo();
  //   });
  // }


  ngAfterViewInit() {
    this.dataSource.paginator = this.paginatorActive;
    this.expiredDataSource.paginator = this.paginatorExpired;
    this.auditDataSource.paginator = this.paginatorAudit;

    if (this.paginator) {
      this.paginator.page.subscribe((event) => {
        this.currentPage = event.pageIndex;
        this.pageSize = event.pageSize;
        this.updatePagedData();
      });
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    const width = window.innerWidth;
    if (width < 600) {
      this.numCols = 1;
    } else if (width < 960) {
      this.numCols = 2;
    } else {
      this.numCols = 3;
    }
  }

  toggleView() {
    if (this.selectedTabIndex === 0) {
      this.isListView = !this.isListView;
      this.isListView ? this.setListView() : this.setCardView();
    } else if (this.selectedTabIndex === 1) {
      this.isExpiredListView = !this.isExpiredListView;
      this.isExpiredListView ? this.setListView() : this.setCardView();
    }
  }
  getDocumentSize(sizeInKB: number): string {
    if (sizeInKB < 1024) {
      return `${sizeInKB.toFixed(2)} KB`;
    } else if (sizeInKB < 1048576) {
      return `${(sizeInKB / 1024).toFixed(2)} MB`;
    } else {
      return `${(sizeInKB / 1048576).toFixed(2)} GB`;
    }
  }

  setCardView() {
    this.numCols = 3;
    this.rowHeight = '1:1';
    this.gutterSize = '10';
  }

  setListView() {
    this.numCols = 1;
    this.rowHeight = this.listViewHeight;
    this.gutterSize = '5';
  }

  navigateToDetail(dataRoom: DataRoom): void {
    if (dataRoom?.id) {
      this.router.navigate(['/layout/data-room-detail', dataRoom.id]);
    } else {
      console.error('Invalid DataRoom:', dataRoom);
    }
  }

  toggleSearch() {
    this.searchExpanded = !this.searchExpanded;
    if (!this.searchExpanded) this.clearSearch();
  }

  clearSearch() {
    this.searchTerm = '';
    this.applySearchToAllTabs();
  }

  applySearchToAllTabs() {
    const term = this.searchTerm.trim().toLowerCase();

    if (term.length < 3) {
      this.filteredDataRooms = this.files;
      this.filteredExpiredRooms = this.expiredRooms;
      this.filteredAuditLogs = this.auditLogs;
    } else {
      this.filteredDataRooms = this.files.filter((file) =>
        (file.document?.name?.toLowerCase() || '').includes(term) ||
        (file.documentId?.toLowerCase() || '').includes(term) ||
        (file.documentPermission?.toLowerCase() || '').includes(term)
      );

      this.filteredAuditLogs = this.auditLogs.filter((log) =>
        log.dataRoomName.toLowerCase().includes(term) ||
        log.documentName.toLowerCase().includes(term) ||
        log.UserName.toLowerCase().includes(term) ||
        log.actionName.toLowerCase().includes(term) ||
        log.actionBy.toLowerCase().includes(term) ||
        log.actionDate.toLowerCase().includes(term)
      );
    }

    this.currentPage = 0;
    this.updatePagedData();
    this.updatePagedAuditLogs();
  }

  getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
  canAddDocuments: boolean = false;
  getMockRoomInfo(): void {
    const randomId = Math.floor(Math.random() * 1000);

    const res = {
      dataRoom: {
        id: randomId,
        name: `Demo Data Room #${randomId}`,
        expirationDate: '2025-12-31',
        owner: 'owner@example.com',
        createdBy: 'System Admin'
      },
      files: [
        {
          documentId: 'doc001',
          document: { name: 'Company Financials.pdf' },
          documentPermission: 'view,download'
        },
        {
          documentId: 'doc002',
          document: { name: 'HR Policies.docx' },
          documentPermission: 'view,edit'
        },
        {
          documentId: 'doc003',
          document: { name: 'Audit Report.xlsx' },
          documentPermission: 'view,download,edit'
        },
        {
          documentId: 'doc004',
          document: { name: 'NDA Agreement.pdf' },
          documentPermission: 'view'
        }
      ],
      permission: {
        userPermission: 'view,download,edit',
        dataRoomPermission: 'add,delete'
      }
    };

    this.dataRoom = res.dataRoom;
    console.log(this.dataRoom)
    if (this.commonHeader) {
      this.commonHeader.dataRoom = this.dataRoom;
    }

    this.files = res.files;

    this.userPermission = res.permission?.userPermission || '';
    this.dataRoomPermission = res.permission?.dataRoomPermission || '';

    this.documentPermissions = this.files.map(f => ({
      documentId: f.documentId,
      permission: f.documentPermission,
      documentName: f.document?.name
    }));

    this.files = this.files.map(file => ({
      ...file,
      permissionFlags: {
        canView: this.hasPermission(file, 'view'),
        canDownload: this.hasPermission(file, 'download'),
        canEdit: this.hasPermission(file, 'edit'),
        canDelete: this.hasPermission(file, 'delete')
      }
    }));

    this.canAddDocuments = this.hasPermission(this.dataRoom, 'add');
    this.dataSource.data = this.files;

    console.log('Mock Files with permissions:', this.files);
  }

  getAllRoomInfo() {
    const MasterUserId = this.getCookie('MasterUserId') || '';
    this.manageDataRoomService.getDataRoomDetailsById(MasterUserId, this.dataRoomId)
      .subscribe((res: any) => {
        console.log('Data Room Details:', res);
        this.dataRoom = res.dataRoom;
        if (this.commonHeader) {
          this.commonHeader.dataRoom = this.dataRoom;
        }
        this.files = res.files || [];

        this.userPermission = res.permission?.userPermission || '';
        this.dataRoomPermission = res.permission?.dataRoomPermission || '';

        this.documentPermissions = this.files.map(f => ({
          documentId: f.documentId,
          permission: f.documentPermission,
          documentName: f.document?.name
        }));
        this.files = this.files.map(file => ({
          ...file,
          permissionFlags: {
            canView: this.hasPermission(file, 'view'),
            canDownload: this.hasPermission(file, 'download'),
            canEdit: this.hasPermission(file, 'edit'),
            canDelete: this.hasPermission(file, 'delete')
          }
        }));
        this.filteredDataRooms = this.files;
        console.log('Files with permissions:', this.files);
        this.canAddDocuments = this.hasPermission(this.dataRoom, 'add');
        this.dataSource.data = this.files;
        this.updatePagedData();

        // --- AUDIT LOGS MAPPING ---
        this.auditLogs = (res.auditLogs || []).map((log: any) => ({
          dataRoomName: log.dataRoomName,
          documentName: log.documentName,
          UserName: log.createdByName || log.UserName || '',
          actionName: log.actionName,
          actionBy: log.createdByName || log.actionBy || '',
          actionDate: log.createdDate || log.actionDate || ''
        }));
        this.filteredAuditLogs = this.auditLogs;
        this.updatePagedAuditLogs();
      });
  }

  openUploadModal(): void {
    const dialogRef = this.dialog.open(UploadDocDataRoomComponent, {
      width: '50vw',
      height: '60vh',
      disableClose: true,
      data: { dataRoomId: this.dataRoomId, DataRoom: this.dataRoom }
    });

    dialogRef.componentInstance.dataChanged.subscribe(() => {
      console.log('Data changed in UploadDocDataRoomComponent');
      this.getAllRoomInfo();
    });
  }

  hasPermission(fileOrRoom: any, action: 'view' | 'download' | 'edit' | 'delete' | 'add'): boolean {
    const documentPermission = fileOrRoom?.documentPermission?.toLowerCase?.();
    const dataRoomPermission = this.dataRoomPermission?.toLowerCase();
    const userPermission = this.userPermission?.toLowerCase();
    const masterUserId = this.getCookie('MasterUserId');

    const effectivePermission = documentPermission || dataRoomPermission || userPermission;

    switch (action) {
      case 'view':
        return ['view', 'view_download', 'contributor', 'editor'].includes(effectivePermission);
      case 'download':
        return ['view_download', 'contributor', 'editor'].includes(effectivePermission);
      case 'edit':
        return ['contributor', 'editor'].includes(effectivePermission);
      case 'delete':
        return effectivePermission === 'editor' ||
          fileOrRoom?.document?.createdBy?.toLowerCase() === masterUserId?.toLowerCase();
      case 'add':

        return ['contributor', 'editor'].includes(dataRoomPermission || userPermission);
      default:
        return false;
    }
  }


  downloadDocument(documentInfo: any) {

    console.log(documentInfo);
    this.sub$.add(
      this.commonService.downloadDocument(documentInfo.id, false).subscribe({
        next: (event) => {

          console.log('Download event:', event);
          if (event.type === HttpEventType.Response) {
            this.downloadFile(event, documentInfo);
          }
        },
        error: (error: any) => {
          this.toastrService.error("Error downloading document: " + error.message);
        }
      })
    );
  }


  private downloadFile(data: HttpResponse<Blob>, documentInfo: any) {
    const blobData = data.body;

    if (!blobData || blobData.size === 0) {
      this.toastrService.error('Download failed: file is empty.');
      return;
    }

    const mimeType = data.headers.get('Content-Type') || 'application/octet-stream';
    const blob = new Blob([blobData], { type: mimeType });

    // Extract extension from URL (e.g. .pdf)
    const extensionFromUrl = this.getFileExtensionFromUrl(documentInfo.url);
    const safeName = documentInfo.name?.trim().replace(/\s+/g, '_') || 'downloaded_file';

    // Ensure extension is appended if not already
    const fileName = safeName.endsWith(extensionFromUrl) ? safeName : `${safeName}${extensionFromUrl}`;

    console.log('Content-Type:', mimeType);
    console.log('Blob size:', blobData.size);
    console.log('Download filename:', fileName);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }




  private getFileExtensionFromUrl(url: string): string {
    if (!url) return '';
    const parts = url.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }



  formatFileSize(sizeInBytes: number): string {
    if (sizeInBytes >= 1024 * 1024) {
      return (sizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
    } else {
      return (sizeInBytes / 1024).toFixed(2) + ' KB';
    }
  }

  formatActionName(actionName: string): string {
    const actionMap: { [key: string]: string } = {
      PermissionEdited: 'Permission Edited',
      DocumentCreated: 'Document Created',
      DocumentDeleted: 'Document Deleted',
      DataRoomCreated: 'Data Room Created',
      DataRoomUpdated: 'Data Room Updated',
      DataRoomDeleted: 'Data Room Deleted',
      DocumentViewed: 'Document Viewed',
      UserCreated: 'User Created',
      UserLoggedIn: 'User Logged In',
      UserDeleted: 'User Deleted',
      EmailSended: 'Email Sent',
    };
    return actionMap[actionName] || actionName || 'Unknown Action';
  }

  updatePagedData() {
    const startIndex = this.currentPage * this.pageSize;
    this.pagedDataRooms = this.filteredDataRooms.slice(startIndex, startIndex + this.pageSize);
  }

  updatePagedExpiredData() {
    const startIndex = this.expiredCurrentPage * this.expiredPageSize;
    this.pagedExpiredRooms = this.filteredExpiredRooms.slice(startIndex, startIndex + this.expiredPageSize);
  }

  // updatePagedAuditLogs() {
  //   const startIndex = this.auditCurrentPage * this.auditPageSize;
  //   this.pagedAuditLogs = this.filteredAuditLogs.slice(startIndex, startIndex + this.auditPageSize);
  //   this.auditDataSource.data = this.pagedAuditLogs;
  // }

  openManageDataRoomModal(room: DataRoom): void {
    console.log('Manage Data Room clicked for:', room);
    this.toastrService.info('Manage Data Room clicked for: ' + room.name);
  }




  deleteFile(data: any) {

    console.log('Deleting file:', data);
    this.sub$.add(
      this.commonDialogService
        .deleteConformationDialog(`${this.translationService.getValue('ARE_YOU_SURE_YOU_WANT_TO_DELETE')}?`)
        .subscribe((isTrue: boolean) => {
          if (isTrue) {
            data.dataRoomId = this.dataRoomId;
            data.UserId = this.getCookie('MasterUserId') || '';

            console.log(data, 'data in deleteDataRoomFile');

            this.manageDataRoomService.deleteDocumentFromDataRoom(data.documentId, data.dataRoomId, data.UserId).subscribe(
              (response: any) => {
                this.toastrService.success('Document deleted successfully.');
                this.getAllRoomInfo();
              },
              (error: any) => {
                this.toastrService.error('Failed to delete document.',);
                console.error('Error deleting data room file:', error);
              }
            );
          }
        })
    );
  }



  isAudioFile(url: string): boolean {
    const imageExtensions = ["3gp", "aa", "aac", "aax", "act", "aiff", "alac", "amr", "ape", "au", "awb", "dss", "dvf", "flac", "gsm", "iklx", "ivs", "m4a", "m4b", "m4p", "mmf", "mp3", "mpc", "msv", "nmf", "ogg", "oga", "mogg", "opus", "org", "ra", "rm", "raw", "rf64", "sln", "tta", "voc", "vox", "wav", "wma", "wv"];
    return imageExtensions.includes(this.getFileExtension(url));
  }

  isVideoFile(url: string): boolean {
    const imageExtensions = ["webm", "flv", "vob", "ogv", "ogg", "drc", "avi", "mts", "m2ts", "wmv", "yuv", "viv", "mp4", "m4p", "3pg", "flv", "f4v", "f4a"];
    return imageExtensions.includes(this.getFileExtension(url));
  }

  isImageFile(url: string): boolean {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "tiff", "psd", "bmp", "webp", "raw", "heif", "indd", "svg", "ai", "eps"];
    return imageExtensions.includes(this.getFileExtension(url));
  }

  getFileExtension(url: string): string {
    return url.split('.').pop()?.toLowerCase() || '';
  }
  editFile(file: any): void {
    console.log('Editing file:', file);
    // Add logic for editing the file
  }
  viewFile(file: any): void {

    console.log(file)
    const documentId = file?.documentId;
    if (!documentId) {
      this.toastrService.error('Invalid document ID.');
      return;
    }

  this.commonService.downloadDocument(documentId, false).subscribe({
  next: (event: any) => {
    if (event.type === HttpEventType.Response) {
      const response = event as HttpResponse<Blob>;
      const blobB = response.body;

      if (!blobB || blobB.size === 0) {
        this.toastrService.error(this.translationService.getValue('ERROR_WHILE_DOWNLOADING_DOCUMENT'));
        return;
      }

      // Get extension from URL
      const extension = file.document.url?.split('.')?.pop()?.toLowerCase() || '';
      const contentType = this.getMimeTypeFromExtension(extension) || 'application/octet-stream'; // fallback

      // Create blob with correct content type
      const blob = new Blob([response.body!], { type: contentType });

      const safeName = (file?.document?.name || 'document').replace(/\s+/g, '_');
      const finalName = safeName.endsWith(extension) ? safeName : `${safeName}.${extension}`;

      const dialogRef = this.dialog.open(FileViewerDialogComponent, {
        width: '80vw',
        height: '80vh',
        data: {
          id: file?.documentId,
          url: file.document.url,
          fileUrl: "",
          fileName: file.document.name,
          fileExtension: extension,
          Documents: file?.document
        },
        disableClose: true
      });

      dialogRef.afterOpened().subscribe(() => {
        dialogRef.componentInstance.showFileFromBlob(blob, finalName, extension);
      });

      dialogRef.afterClosed().subscribe(() => {
        // Optional: URL cleanup if using createObjectURL
      });
    }
  },
  error: () => {
    this.toastrService.error(this.translationService.getValue('ERROR_WHILE_DOWNLOADING_DOCUMENT'));
  }
});

  }

getMimeTypeFromExtension(extension: string): string {
  const map: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'txt': 'text/plain',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return map[extension.toLowerCase()] || '';
}

  onTabChange(event: MatTabChangeEvent): void {
    this.selectedTabIndex = event.index;
    console.log('Tab changed to index:', this.selectedTabIndex);

    // Ensure the tab content updates correctly
    if (this.selectedTabIndex === 0) {
      console.log('Files tab selected');
    } else if (this.selectedTabIndex === 1) {
      console.log('Audit Log tab selected');
    }
  }

  onSortChange(event: {active: string, direction: string}) {
    this.activeSort = event.active;
    this.sortDirection = event.direction as 'asc' | 'desc';
   
    this.filteredDataRooms = [...this.filteredDataRooms].sort((a: any, b: any) => {
      const aValue = (a.document?.[event.active] || a[event.active] || '').toString().toLowerCase();
      const bValue = (b.document?.[event.active] || b[event.active] || '').toString().toLowerCase();
      if (aValue < bValue) return this.sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    this.currentPage = 0;
    this.updatePagedData();
  }

  onAuditSortChange(event: {active: string, direction: string}) {
    this.auditActiveSort = event.active;
    this.auditSortDirection = event.direction as 'asc' | 'desc';
    this.filteredAuditLogs = [...this.filteredAuditLogs].sort((a: any, b: any) => {
      const aValue = (a[event.active] || '').toString().toLowerCase();
      const bValue = (b[event.active] || '').toString().toLowerCase();
      if (aValue < bValue) return this.auditSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return this.auditSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    this.auditCurrentPage = 0;
    this.updatePagedAuditLogs();
  }

  updatePagedAuditLogs() {
    const startIndex = this.auditCurrentPage * this.auditPageSize;
    this.pagedAuditLogs = this.filteredAuditLogs.slice(startIndex, startIndex + this.auditPageSize);
    this.auditDataSource.data = this.pagedAuditLogs;
  }

  ngOnDestroy() {
    this.sub$.unsubscribe();
  }


  
}
